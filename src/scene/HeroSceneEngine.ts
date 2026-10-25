import { RoarAudio } from './RoarAudio'
import {
  readMotionPreferences,
  saveMotionPreferences,
} from '../persistence/motion-preferences'
import { DeviceQuality } from './DeviceQuality'
import { createPaperAtmosphere } from './ParticleSystem'
import { createCinematicLighting, createPaperGrain } from './LightingController'
import { cinematicCamera } from './CameraDirector'
import { createBlueprintNet } from './BlueprintNet'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createPaperDinosaur } from './PaperDinosaur'
import { DinosaurRig } from './DinosaurRig'
import { HingePanels } from './HingePanels'
import { IntroTimeline, smoothProgress } from './IntroTimeline'
import { awakeningFrame } from './awakening'
import { startRenderLoop } from './renderLoop'
import { disposeScene } from './disposeScene'

export interface SceneCommands {
  skip(): void
  replay(): void
  pause(): void
  reset(): void
  unfold(): void
  reduce(value: boolean): void
  sound(): Promise<boolean>
}

export interface HeroSceneCallbacks {
  onPhase?: (phase: string) => void
  setPhase: (caption: string) => void
  setFallback: (value: boolean) => void
  setReduced: (value: boolean) => void
  setPaused: (value: boolean) => void
  setIsUnfolded: (value: boolean) => void
  onCommands: (commands: SceneCommands | null) => void
}

export function mountHeroScene(
  host: HTMLDivElement,
  callbacks: HeroSceneCallbacks,
): () => void {
  const {
    onPhase,
    setPhase,
    setFallback,
    setReduced,
    setPaused,
    setIsUnfolded,
    onCommands,
  } = callbacks
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const preferences = readMotionPreferences()
  let reduce = preferences.reduce ?? media.matches
  const audio = new RoarAudio()
  let roared = false
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  const quality = new DeviceQuality(
    navigator.hardwareConcurrency || 4,
    window.innerWidth < 700,
    connection?.saveData,
  )

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
      setPhase('정적 제품 미리보기')
      onPhase?.('idle')
    }, 0)
    return () => window.clearTimeout(timer)
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor('#060a13', 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
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
  renderer.domElement.style.touchAction = 'pan-y'
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
  const lighting = createCinematicLighting(scene)
  const atmosphere = createPaperAtmosphere(window.innerWidth < 700 ? 24 : 48)
  scene.add(atmosphere.points)
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
  const model = createPaperDinosaur(quality.quality)
  model.panels[0].material.roughnessMap = createPaperGrain()
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
  if (preferences.seen) timeline.skip()
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
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  observer?.observe(host)
  if (!observer) window.addEventListener('resize', resize)
  resize()
  const reset = () => {
    directed = true
    controls.target.set(-0.5, 2.1, 0)
  }
  const reduceMotion = (value: boolean) => {
    reduce = value
    setReduced(value)
    saveMotionPreferences({ reduce: value })
    if (value) audio.stop()
    if (value) {
      timeline.skip()
      unfolded = false
      setIsUnfolded(false)
      currentUnfold = 0
      reset()
    }
  }
  const preferenceChanged = () => reduceMotion(media.matches)
  media.addEventListener('change', preferenceChanged)
  const stopHiddenAudio = () => {
    if (document.hidden) audio.stop()
  }
  document.addEventListener('visibilitychange', stopHiddenAudio)
  const initialPreferences = window.setTimeout(() => setReduced(reduce), 0)
  onCommands({
    skip: () => {
      audio.stop()
      timeline.skip()
      unfolded = false
      setIsUnfolded(false)
    },
    replay: () => {
      timeline.replay(reduce)
      audio.stop()
      roared = false
      unfolded = false
      setIsUnfolded(false)
      idleTime = 0
      reset()
      motionPaused = false
      setPaused(false)
    },
    pause: () => {
      motionPaused = !motionPaused
      if (motionPaused) audio.stop()
      if (motionPaused) timeline.pause()
      else timeline.resume()
      setPaused(motionPaused)
    },
    reset,
    unfold: () => {
      audio.stop()
      timeline.skip()
      unfolded = !unfolded
      setIsUnfolded(unfolded)
      motionPaused = false
      setPaused(false)
      reset()
    },
    reduce: reduceMotion,
    sound: () => audio.toggle(),
  })
  const applyQuality = () => {
    const low = quality.quality === 'low'
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75),
    )
    renderer.shadowMap.enabled = !low
    atmosphere.setCount(low ? 12 : 48)
    resize()
  }
  applyQuality()
  let renderAccumulator = 1 / 30
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Home') {
      event.preventDefault()
      reset()
      return
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    event.preventDefault()
    directed = false
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    if (event.key === 'ArrowLeft') spherical.theta -= 0.08
    if (event.key === 'ArrowRight') spherical.theta += 0.08
    if (event.key === 'ArrowUp') spherical.phi -= 0.06
    if (event.key === 'ArrowDown') spherical.phi += 0.06
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      0.35,
      Math.PI / 2 - 0.025,
    )
    camera.position
      .copy(controls.target)
      .add(offset.setFromSpherical(spherical))
    controls.update()
  }
  renderer.domElement.addEventListener('keydown', keyboard)
  let stopped = false
  const stop = startRenderLoop(({ delta: frameDelta }) => {
    if (stopped) return
    if (quality.observe(frameDelta)) applyQuality()
    renderAccumulator += frameDelta
    if (quality.quality === 'low' && renderAccumulator < 1 / 30) return
    const delta = motionPaused ? 0 : renderAccumulator
    renderAccumulator = 0
    const frame = timeline.advance(delta)
    if (timeline.state === 'complete' && !motionPaused) idleTime += delta
    if (frame.phase !== lastPhase) {
      lastPhase = frame.phase
      setPhase(labels[frame.phase])
      onPhase?.(frame.phase)
      if (frame.phase === 'idle') saveMotionPreferences({ seen: true })
    }
    currentUnfold = reduce
      ? unfolded
        ? 1
        : 0
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
    atmosphere.update(frame.seconds + idleTime, reduce)
    blueprint.update(frame.blueprint, frame.reveal)
    model.root.traverse((object) => {
      if (object instanceof THREE.Mesh && !model.panels.includes(object))
        object.visible = frame.construction > 0.8 && currentUnfold < 0.2
    })
    const material = model.panels[0].material
    material.transparent = frame.seconds < 3
    material.opacity = 0.02 + smoothProgress(frame.seconds, 1.8, 3) * 0.98
    folds.forEach(({ lines }) => {
      lines.material.opacity = frame.phase === 'blueprint' ? 0.6 : 0.14
      lines.geometry.setDrawRange(
        0,
        Math.floor(
          (lines.geometry.getAttribute('position').count * frame.blueprint) / 2,
        ) * 2,
      )
    })
    const awakening = awakeningFrame(
      frame.phase === 'idle' ? 9 + idleTime : frame.seconds,
      reduce,
    )
    rig.apply(awakening.pose)
    if (!reduce && !roared && frame.seconds >= 6 && frame.seconds < 6.3) {
      audio.play()
      roared = true
    }
    if (document.hidden) audio.stop()
    lighting.update(idleTime, awakening.lightPulse, reduce)
    if (directed) {
      const shot = cinematicCamera(
        frame.seconds,
        camera.aspect,
        idleTime,
        reduce,
      )
      camera.position.set(
        THREE.MathUtils.lerp(shot.x, 2, currentUnfold),
        THREE.MathUtils.lerp(shot.y, 10, currentUnfold) +
          awakening.cameraImpulse,
        THREE.MathUtils.lerp(shot.z, 17, currentUnfold),
      )
      controls.target.set(
        -0.5,
        THREE.MathUtils.lerp(shot.targetY, 0.4, currentUnfold),
        0,
      )
    }
    controls.update()
    renderer.render(scene, camera)
  })
  const contextLost = (event: Event) => {
    event.preventDefault()
    audio.stop()
    stopped = true
    stop()
    setFallback(true)
    setPhase('정적 제품 미리보기')
    onPhase?.('idle')
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  return () => {
    stopped = true
    stop()
    window.clearTimeout(initialPreferences)
    onCommands(null)
    document.removeEventListener('visibilitychange', stopHiddenAudio)
    audio.dispose()
    observer?.disconnect()
    window.removeEventListener('resize', resize)
    media.removeEventListener('change', preferenceChanged)
    controls.removeEventListener('start', userControl)
    controls.dispose()
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    renderer.domElement.removeEventListener('keydown', keyboard)
    disposeScene(scene)
    renderer.dispose()
    renderer.domElement.remove()
  }
}
