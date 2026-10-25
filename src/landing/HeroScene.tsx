import { cinematicCamera } from '../scene/CameraDirector'
import { createBlueprintNet } from '../scene/BlueprintNet'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createPaperDinosaur } from '../scene/PaperDinosaur'
import { DinosaurRig } from '../scene/DinosaurRig'
import { HingePanels } from '../scene/HingePanels'
import { IntroTimeline, smoothProgress } from '../scene/IntroTimeline'
import { awakeningFrame } from '../scene/awakening'
import { startRenderLoop } from '../scene/renderLoop'
import { disposeScene } from '../scene/disposeScene'

interface SceneCommands {
  skip(): void
  replay(): void
  pause(): void
  reset(): void
  unfold(): void
  reduce(value: boolean): void
}

export default function HeroScene({
  onPhase,
}: {
  onPhase?: (phase: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const commands = useRef<SceneCommands | null>(null)
  const [fallback, setFallback] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [phase, setPhase] = useState('종이의 가능성을 준비하고 있습니다')

  useEffect(() => {
    const host = container.current
    if (!host) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduce = media.matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      const timer = window.setTimeout(() => {
        setFallback(true)
        onPhase?.('idle')
      }, 0)
      return () => window.clearTimeout(timer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor('#060a13', 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute(
      'aria-label',
      '실시간 3D 종이 티라노사우루스. 드래그하여 회전할 수 있습니다.',
    )
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.tabIndex = 0
    host.append(renderer.domElement)
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#060a13', 18, 38)
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 8
    controls.maxDistance = 24
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = Math.PI / 2 - 0.025
    controls.target.set(-0.5, 2.1, 0)
    let directed = true
    const userControl = () => {
      directed = false
    }
    controls.addEventListener('start', userControl)
    scene.add(new THREE.HemisphereLight('#e6efff', '#2a2330', 2.2))
    const key = new THREE.DirectionalLight('#fff2df', 4.2)
    key.position.set(1, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -8
    key.shadow.camera.right = 8
    key.shadow.camera.top = 8
    key.shadow.camera.bottom = -8
    key.shadow.normalBias = 0.04
    scene.add(key)
    const rim = new THREE.DirectionalLight('#72abff', 4)
    rim.position.set(-3, 5, -4)
    scene.add(rim)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(30, 60, '#24476a', '#172539')
    grid.position.y = -0.01
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.3
    scene.add(grid)
    const model = createPaperDinosaur(window.innerWidth < 700 ? 'low' : 'high')
    scene.add(model.root)
    const blueprint = createBlueprintNet(
      new THREE.Box3().setFromObject(model.root),
    )
    scene.add(blueprint.group)
    const rig = new DinosaurRig(model)
    const folds = model.panels.map((mesh) => {
      const worldPosition = mesh.getWorldPosition(new THREE.Vector3())
      const flatOrigin = mesh.worldToLocal(
        new THREE.Vector3(worldPosition.x, 0.04, worldPosition.z * 2),
      )
      const inverseRotation = mesh
        .getWorldQuaternion(new THREE.Quaternion())
        .invert()
      const flatNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(
        inverseRotation,
      )
      const hinge = new HingePanels(mesh.geometry, {
        normal: flatNormal,
        origin: flatOrigin,
      })
      mesh.geometry.dispose()
      mesh.geometry = hinge.geometry
      for (const child of [...mesh.children]) {
        disposeScene(child)
        mesh.remove(child)
      }
      const positions = hinge.geometry.getAttribute('position')
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          new Float32Array(positions.count * 6),
          3,
        ).setUsage(THREE.DynamicDrawUsage),
      )
      const material = new THREE.LineBasicMaterial({
        color: '#72abff',
        transparent: true,
        opacity: 0.35,
      })
      const lines = new THREE.LineSegments(geometry, material)
      mesh.add(lines)
      return { mesh, hinge, lines, previous: -1 }
    })
    const timeline = new IntroTimeline(reduce)
    try {
      if (sessionStorage.getItem('paper-studio.intro-seen') === '1')
        timeline.skip()
    } catch {
      /* Storage may be disabled. */
    }
    let lastPhase = ''
    let unfolded = false
    let currentUnfold = 0
    let idleTime = 0
    let motionPaused = false
    const labels = {
      blueprint: '01 — THE BLUEPRINT',
      construction: '02 — THE CONSTRUCTION',
      awakening: '03 — THE AWAKENING',
      reveal: '04 — FROM PAPER TO POSSIBILITY',
      idle: 'PAPER TYRANNOSAURUS · ORIGINAL PROCEDURAL STUDY',
    }
    const resize = () => {
      const width = host.clientWidth || 640
      const height = host.clientHeight || 520
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    const reset = () => {
      directed = true
      controls.target.set(-0.5, 2.1, 0)
    }
    const reduceMotion = (value: boolean) => {
      reduce = value
      setReduced(value)
      if (value) {
        timeline.skip()
        unfolded = false
        currentUnfold = 0
        reset()
      }
    }
    const preferenceChanged = () => reduceMotion(media.matches)
    media.addEventListener('change', preferenceChanged)
    const initialPreferences = window.setTimeout(() => setReduced(reduce), 0)
    commands.current = {
      skip: () => {
        timeline.skip()
        unfolded = false
      },
      replay: () => {
        timeline.replay(reduce)
        unfolded = false
        idleTime = 0
        reset()
        motionPaused = false
        setPaused(false)
      },
      pause: () => {
        motionPaused = !motionPaused
        if (motionPaused) timeline.pause()
        else timeline.resume()
        setPaused(motionPaused)
      },
      reset,
      unfold: () => {
        timeline.skip()
        unfolded = !unfolded
      },
      reduce: reduceMotion,
    }
    let stopped = false
    const stop = startRenderLoop(({ delta: frameDelta }) => {
      if (stopped) return
      const delta = motionPaused ? 0 : frameDelta
      const frame = timeline.advance(delta)
      if (timeline.state === 'complete' && !motionPaused) idleTime += delta
      if (frame.phase !== lastPhase) {
        lastPhase = frame.phase
        setPhase(labels[frame.phase])
        onPhase?.(frame.phase)
        if (frame.phase === 'idle') {
          try {
            sessionStorage.setItem('paper-studio.intro-seen', '1')
          } catch {
            /* Optional preference. */
          }
        }
      }
      currentUnfold = reduce
        ? 0
        : THREE.MathUtils.damp(currentUnfold, unfolded ? 1 : 0, 5, delta)
      folds.forEach((fold, index) => {
        const assembly =
          1 -
          smoothProgress(frame.seconds, 2 + index * 0.035, 4.3 + index * 0.035)
        const unfold = frame.phase === 'idle' ? currentUnfold : assembly
        if (Math.abs(unfold - fold.previous) < 0.0001) return
        fold.previous = unfold
        fold.hinge.update(unfold)
        const vertices = fold.hinge.geometry.getAttribute('position')
        const edges = fold.lines.geometry.getAttribute(
          'position',
        ) as THREE.BufferAttribute
        for (let face = 0; face < vertices.count; face += 3) {
          for (let edge = 0; edge < 3; edge++) {
            const a = face + edge,
              b = face + ((edge + 1) % 3)
            const start = face * 2 + edge * 2
            edges.setXYZ(
              start,
              vertices.getX(a),
              vertices.getY(a),
              vertices.getZ(a),
            )
            edges.setXYZ(
              start + 1,
              vertices.getX(b),
              vertices.getY(b),
              vertices.getZ(b),
            )
          }
        }
        edges.needsUpdate = true
        fold.lines.geometry.computeBoundingSphere()
      })
      blueprint.update(frame.blueprint, frame.reveal)
      const material = model.panels[0].material
      material.transparent = frame.seconds < 3
      material.opacity = 0.02 + smoothProgress(frame.seconds, 1.8, 3) * 0.98
      folds.forEach(({ lines }) => {
        lines.material.opacity = frame.phase === 'blueprint' ? 0.6 : 0.14
        lines.geometry.setDrawRange(
          0,
          Math.floor(
            (lines.geometry.getAttribute('position').count * frame.blueprint) /
              2,
          ) * 2,
        )
      })
      const awakening = awakeningFrame(
        frame.phase === 'idle' ? 9 + idleTime : frame.seconds,
        reduce,
      )
      rig.apply(awakening.pose)
      rim.intensity = 4 + awakening.lightPulse * 3
      if (directed) {
        const shot = cinematicCamera(
          frame.seconds,
          camera.aspect,
          idleTime,
          reduce,
        )
        camera.position.set(shot.x, shot.y + awakening.cameraImpulse, shot.z)
        controls.target.set(-0.5, shot.targetY, 0)
      }
      controls.update()
      renderer.render(scene, camera)
    })
    const contextLost = (event: Event) => {
      event.preventDefault()
      stopped = true
      stop()
      setFallback(true)
      onPhase?.('idle')
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    return () => {
      stopped = true
      stop()
      window.clearTimeout(initialPreferences)
      commands.current = null
      observer.disconnect()
      media.removeEventListener('change', preferenceChanged)
      controls.removeEventListener('start', userControl)
      controls.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      disposeScene(scene)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [onPhase])

  return (
    <div className="cinematic-showcase">
      <div ref={container} className="cinematic-canvas" hidden={fallback} />
      {fallback && (
        <div className="cinematic-fallback">
          <span>FROM PAPER TO POSSIBILITY</span>
          <p>종이 한 장에서 시작되는 입체의 가능성.</p>
          <a href="/studio">스튜디오 시작하기 →</a>
        </div>
      )}
      <p className="cinematic-caption" aria-live="polite">
        {phase}
      </p>
      {!fallback && (
        <div className="cinematic-controls" aria-label="3D 장면 제어">
          <button onClick={() => commands.current?.skip()}>건너뛰기</button>
          <button onClick={() => commands.current?.replay()}>다시 보기</button>
          <button
            aria-pressed={paused}
            onClick={() => commands.current?.pause()}
          >
            {paused ? '재생' : '일시정지'}
          </button>
          <button onClick={() => commands.current?.unfold()}>
            펼치기 / 접기
          </button>
          <button onClick={() => commands.current?.reset()}>시점 초기화</button>
          <button
            aria-pressed={reduced}
            onClick={() => commands.current?.reduce(!reduced)}
          >
            모션 줄이기
          </button>
        </div>
      )}
    </div>
  )
}
