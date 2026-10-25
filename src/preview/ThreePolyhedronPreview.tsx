import { startRenderLoop } from '../scene/renderLoop'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PolyhedronMesh, UnfoldedNet } from '../geometry'
import { solveFoldPoses, transformPoint } from '../folding'
import type { FoldGraph } from '../folding'
import type { FaceMaterial } from '../materials/materials'

type ThreePolyhedronPreviewProps = {
  mesh: PolyhedronMesh
  layout: UnfoldedNet
  faceMaterials?: Record<string, FaceMaterial>
  foldGraph: FoldGraph
  foldProgress: number
  cameraResetToken: number
  selectedFaceId: string | null
  hingeProgressById?: Readonly<Record<string, number>>
  onFaceSelect: (faceId: string) => void
}

type FaceMesh = THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>
type PreviewScene = {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  faceMeshes: Map<string, FaceMesh>
  renderer: THREE.WebGLRenderer
  resizeObserver: ResizeObserver | null
}

const BASE_FACE_COLOR = '#566174'
const SELECTED_FACE_COLOR = '#4386f5'

function centerOf(points: Array<{ x: number; y: number }>) {
  const sum = points.reduce(
    (center, point) => ({ x: center.x + point.x, y: center.y + point.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export function ThreePolyhedronPreview({
  mesh,
  layout,
  faceMaterials = {},
  foldGraph,
  foldProgress,
  cameraResetToken,
  selectedFaceId,
  hingeProgressById,
  onFaceSelect,
}: ThreePolyhedronPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<PreviewScene | null>(null)
  const onFaceSelectRef = useRef(onFaceSelect)
  const [webglUnavailable, setWebglUnavailable] = useState(false)

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
      const timer = window.setTimeout(() => setWebglUnavailable(true), 0)
      return () => window.clearTimeout(timer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'three-preview__canvas'
    renderer.domElement.setAttribute(
      'aria-label',
      '다면체 접힘 시뮬레이션 3D 미리보기',
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

    const faceMeshes = new Map<string, FaceMesh>()
    const group = new THREE.Group()
    for (const face of layout.faces) {
      const center = centerOf(face.polygon)
      const shape = new THREE.Shape()
      face.polygon.forEach((point, index) => {
        const x = point.x - center.x
        const y = point.y - center.y
        if (index === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      })
      shape.closePath()
      const geometry = new THREE.ShapeGeometry(shape)
      const material = new THREE.MeshStandardMaterial({
        color: BASE_FACE_COLOR,
        roughness: 0.78,
        side: THREE.DoubleSide,
      })
      const faceMesh = new THREE.Mesh(geometry, material)
      faceMesh.name = `paper-face-${face.id}`
      faceMesh.userData.faceId = face.id
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: '#b9c4d6' }),
      )
      faceMesh.add(lines)
      group.add(faceMesh)
      faceMeshes.set(face.id, faceMesh)
    }
    scene.add(group)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    const preview: PreviewScene = {
      camera,
      controls,
      faceMeshes,
      renderer,
      resizeObserver: null,
    }
    previewRef.current = preview
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      camera.aspect = Math.max(1, width) / Math.max(1, height)
      camera.updateProjectionMatrix()
      renderer.setSize(Math.max(1, width), Math.max(1, height), false)
    }
    resize()
    if (typeof ResizeObserver !== 'undefined') {
      preview.resizeObserver = new ResizeObserver(resize)
      preview.resizeObserver.observe(container)
    } else window.addEventListener('resize', resize)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerStart: { x: number; y: number } | null = null
    const onDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
    }
    const onUp = (event: PointerEvent) => {
      if (!pointerStart) return
      const moved = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      )
      pointerStart = null
      if (moved > 5) return
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster
        .intersectObject(group, true)
        .find((intersection) => intersection.object.userData.faceId)
      const faceId = hit?.object.userData.faceId as string | undefined
      if (faceId) onFaceSelectRef.current(faceId)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    const stopRendering = startRenderLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      preview.resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      stopRendering()
      controls.dispose()
      faceMeshes.forEach((faceMesh) => {
        faceMesh.geometry.dispose()
        faceMesh.material.dispose()
        const lines = faceMesh.children[0] as THREE.LineSegments<
          THREE.EdgesGeometry,
          THREE.LineBasicMaterial
        >
        lines.geometry.dispose()
        lines.material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
      scene.clear()
      previewRef.current = null
    }
  }, [layout])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    const radius = Math.max(
      ...mesh.vertices.map((vertex) =>
        Math.hypot(vertex.position.x, vertex.position.y, vertex.position.z),
      ),
    )
    const extent = Math.max(
      radius * 2,
      layout.bounds.width,
      layout.bounds.height,
    )
    preview.camera.near = Math.max(0.01, extent / 1_000)
    preview.camera.far = extent * 30
    preview.camera.position.set(extent * 2.2, extent * 1.8, extent * 2.5)
    preview.camera.lookAt(0, 0, 0)
    preview.camera.updateProjectionMatrix()
    preview.controls.target.set(0, 0, 0)
    preview.controls.minDistance = extent * 0.55
    preview.controls.maxDistance = extent * 12
    preview.controls.update()
  }, [cameraResetToken, layout, mesh])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    preview.faceMeshes.forEach((faceMesh, faceId) => {
      const selected = faceId === selectedFaceId
      faceMesh.material.color.set(
        selected
          ? SELECTED_FACE_COLOR
          : (faceMaterials[faceId]?.color ?? BASE_FACE_COLOR),
      )
      faceMesh.material.emissive.set(selected ? '#102342' : '#000000')
    })
  }, [faceMaterials, layout, selectedFaceId])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    let cancelled = false
    const loader = new THREE.TextureLoader()
    preview.faceMeshes.forEach((mesh, faceId) => {
      const settings = faceMaterials[faceId]?.texture
      mesh.material.map?.dispose()
      mesh.material.map = null
      mesh.material.needsUpdate = true
      if (!settings) return
      loader.load(settings.dataUrl, (texture) => {
        if (cancelled) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(1 / settings.scale, 1 / settings.scale)
        texture.offset.set(settings.offsetX / 100, settings.offsetY / 100)
        texture.center.set(0.5, 0.5)
        texture.rotation = (settings.rotationDeg * Math.PI) / 180
        mesh.material.map = texture
        mesh.material.needsUpdate = true
      })
    })
    return () => {
      cancelled = true
      preview.faceMeshes.forEach((mesh) => {
        mesh.material.map?.dispose()
        mesh.material.map = null
      })
    }
  }, [faceMaterials, layout])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    const poses = solveFoldPoses(foldGraph, foldProgress, hingeProgressById)
    const faceById = new Map(layout.faces.map((face) => [face.id, face]))
    const transformed = poses.flatMap((pose) => {
      const face = faceById.get(pose.faceId)!
      const center = centerOf(face.polygon)
      return face.polygon.map((point) =>
        transformPoint(pose.transform, {
          x: point.x - center.x,
          y: point.y - center.y,
          z: 0,
        }),
      )
    })
    const bounds = {
      x:
        (Math.min(...transformed.map((point) => point.x)) +
          Math.max(...transformed.map((point) => point.x))) /
        2,
      y:
        (Math.min(...transformed.map((point) => point.y)) +
          Math.max(...transformed.map((point) => point.y))) /
        2,
      z:
        (Math.min(...transformed.map((point) => point.z)) +
          Math.max(...transformed.map((point) => point.z))) /
        2,
    }
    for (const pose of poses) {
      const faceMesh = preview.faceMeshes.get(pose.faceId)
      if (!faceMesh) continue
      faceMesh.position.set(
        pose.transform.translation.x - bounds.x,
        pose.transform.translation.y - bounds.y,
        pose.transform.translation.z - bounds.z,
      )
      faceMesh.quaternion.set(
        pose.transform.rotation.x,
        pose.transform.rotation.y,
        pose.transform.rotation.z,
        pose.transform.rotation.w,
      )
    }
  }, [foldGraph, foldProgress, hingeProgressById, layout])

  return (
    <section
      className="three-preview"
      aria-label="다면체 3D 접힘 시뮬레이션 패널"
    >
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
