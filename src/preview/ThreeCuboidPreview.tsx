import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Cuboid, FaceId } from '../geometry'
import { faceIdForMaterialIndex } from './face-mapping'

type ThreeCuboidPreviewProps = {
  cuboid: Cuboid
  selectedFaceId: FaceId | null
  onFaceSelect: (faceId: FaceId) => void
}

const MATERIAL_FACE_IDS: FaceId[] = [
  'right',
  'left',
  'top',
  'bottom',
  'back',
  'front',
]
const BASE_FACE_COLOR = '#566174'
const SELECTED_FACE_COLOR = '#4386f5'

type PreviewScene = {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  edgeGeometry: THREE.EdgesGeometry
  edgeMaterial: THREE.LineBasicMaterial
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]>
  materials: THREE.MeshStandardMaterial[]
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  resizeObserver: ResizeObserver | null
  animationFrameId: number
  lastLargestDimension: number
}

export function ThreeCuboidPreview({
  cuboid,
  selectedFaceId,
  onFaceSelect,
}: ThreeCuboidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<PreviewScene | null>(null)
  const onFaceSelectRef = useRef(onFaceSelect)
  const [webglUnavailable, setWebglUnavailable] = useState(false)
  const { widthMm, depthMm, heightMm } = cuboid.dimensions

  useEffect(() => {
    onFaceSelectRef.current = onFaceSelect
  }, [onFaceSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#151a23')

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100_000)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      const fallbackTimer = window.setTimeout(
        () => setWebglUnavailable(true),
        0,
      )
      return () => window.clearTimeout(fallbackTimer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'three-preview__canvas'
    renderer.domElement.setAttribute(
      'aria-label',
      'Three.js 직육면체 3D 미리보기',
    )
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.tabIndex = 0
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight('#e8efff', '#343b49', 2))
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.5)
    keyLight.position.set(250, 350, 400)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#91a9d8', 1.1)
    fillLight.position.set(-300, 80, -250)
    scene.add(fillLight)

    const materials = MATERIAL_FACE_IDS.map(
      (faceId) =>
        new THREE.MeshStandardMaterial({
          color: faceId === 'front' ? SELECTED_FACE_COLOR : BASE_FACE_COLOR,
          roughness: 0.78,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
    )
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.Mesh(geometry, materials)
    mesh.name = 'paper-studio-cuboid'
    scene.add(mesh)

    const edgeGeometry = new THREE.EdgesGeometry(geometry)
    const edgeMaterial = new THREE.LineBasicMaterial({ color: '#b9c4d6' })
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    edgeLines.name = 'cuboid-edges'
    mesh.add(edgeLines)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true

    const preview: PreviewScene = {
      camera,
      controls,
      edgeGeometry,
      edgeMaterial,
      mesh,
      materials,
      renderer,
      scene,
      resizeObserver: null,
      animationFrameId: 0,
      lastLargestDimension: 0,
    }
    previewRef.current = preview

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      const safeWidth = Math.max(1, width)
      const safeHeight = Math.max(1, height)
      camera.aspect = safeWidth / safeHeight
      camera.updateProjectionMatrix()
      renderer.setSize(safeWidth, safeHeight, false)
    }
    resize()

    if (typeof ResizeObserver !== 'undefined') {
      preview.resizeObserver = new ResizeObserver(resize)
      preview.resizeObserver.observe(container)
    } else {
      window.addEventListener('resize', resize)
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerStart: { x: number; y: number } | null = null
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart) return
      const moved = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      )
      pointerStart = null
      if (moved > 5) return

      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const [intersection] = raycaster.intersectObject(mesh, false)
      const faceId = faceIdForMaterialIndex(intersection?.face?.materialIndex)
      if (faceId) onFaceSelectRef.current(faceId)
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)

    const animate = () => {
      preview.animationFrameId = window.requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      preview.resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      window.cancelAnimationFrame(preview.animationFrameId)
      controls.dispose()
      geometry.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      materials.forEach((material) => material.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      scene.clear()
      previewRef.current = null
    }
  }, [])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    const largestDimension = Math.max(widthMm, heightMm, depthMm)
    preview.mesh.scale.set(widthMm, heightMm, depthMm)
    preview.camera.near = Math.max(0.01, largestDimension / 1_000)
    preview.camera.far = largestDimension * 30
    if (preview.lastLargestDimension === 0) {
      preview.camera.position.set(
        largestDimension * 1.8,
        largestDimension * 1.45,
        largestDimension * 2.1,
      )
    } else {
      preview.camera.position.multiplyScalar(
        largestDimension / preview.lastLargestDimension,
      )
    }
    preview.lastLargestDimension = largestDimension
    preview.camera.lookAt(0, 0, 0)
    preview.camera.updateProjectionMatrix()
    preview.controls.target.set(0, 0, 0)
    preview.controls.minDistance = largestDimension * 0.55
    preview.controls.maxDistance = largestDimension * 12
    preview.controls.update()
  }, [depthMm, heightMm, widthMm])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    preview.materials.forEach((material, index) => {
      const isSelected = MATERIAL_FACE_IDS[index] === selectedFaceId
      material.color.set(isSelected ? SELECTED_FACE_COLOR : BASE_FACE_COLOR)
      material.emissive.set(isSelected ? '#102342' : '#000000')
    })
  }, [selectedFaceId])

  return (
    <section className="three-preview" aria-label="3D 미리보기 패널">
      {webglUnavailable ? (
        <div className="preview-error" role="status">
          이 브라우저에서는 WebGL을 사용할 수 없어 3D 미리보기를 표시하지
          못합니다.
        </div>
      ) : (
        <div ref={containerRef} className="three-preview__viewport" />
      )}
      <span className="three-preview__hint">
        드래그하여 회전 · 스크롤하여 확대
      </span>
    </section>
  )
}
