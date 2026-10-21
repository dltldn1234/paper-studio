import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Cuboid, FaceId, NetLayout } from '../geometry'
import {
  createCuboidFoldGraph,
  solveFoldPoses,
  transformPoint,
} from '../folding'
import type { FaceMaterial } from '../materials/materials'

type ThreeCuboidPreviewProps = {
  cuboid: Cuboid
  netLayout: NetLayout
  faceMaterials?: Record<string, FaceMaterial>
  foldProgress: number
  cameraResetToken: number
  selectedFaceId: FaceId | null
  onFaceSelect: (faceId: FaceId) => void
}

const BASE_FACE_COLOR = '#566174'
const SELECTED_FACE_COLOR = '#4386f5'
type FaceMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
type PreviewScene = {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  faceMeshes: Map<FaceId, FaceMesh>
  renderer: THREE.WebGLRenderer
  resizeObserver: ResizeObserver | null
  animationFrameId: number
}

export function ThreeCuboidPreview({
  cuboid,
  netLayout,
  faceMaterials = {},
  foldProgress,
  cameraResetToken,
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
      const timer = window.setTimeout(() => setWebglUnavailable(true), 0)
      return () => window.clearTimeout(timer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'three-preview__canvas'
    renderer.domElement.setAttribute(
      'aria-label',
      '접힘 시뮬레이션 3D 미리보기',
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

    const faceMeshes = new Map<FaceId, FaceMesh>()
    const group = new THREE.Group()
    for (const face of cuboid.faces) {
      const material = new THREE.MeshStandardMaterial({
        color: BASE_FACE_COLOR,
        roughness: 0.78,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(face.widthMm, face.heightMm),
        material,
      )
      mesh.name = `paper-face-${face.id}`
      mesh.userData.faceId = face.id
      // The net's Y axis points down; invert local Y to match its coordinate frame.
      mesh.scale.y = -1
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: '#b9c4d6' }),
      )
      mesh.add(edgeLines)
      group.add(mesh)
      faceMeshes.set(face.id, mesh)
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
      animationFrameId: 0,
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
      const faceId = hit?.object.userData.faceId as FaceId | undefined
      if (faceId) onFaceSelectRef.current(faceId)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    const animate = () => {
      preview.animationFrameId = window.requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      preview.resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      window.cancelAnimationFrame(preview.animationFrameId)
      controls.dispose()
      faceMeshes.forEach((mesh) => {
        mesh.geometry.dispose()
        mesh.material.dispose()
        const lines = mesh.children[0] as THREE.LineSegments<
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
  }, [cuboid])

  useEffect(() => {
    const preview = previewRef.current
    if (preview) cameraFit(preview, Math.max(widthMm, depthMm, heightMm))
  }, [cameraResetToken, depthMm, heightMm, widthMm])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    for (const [faceId, material] of [...preview.faceMeshes].map(
      ([id, mesh]) => [id, mesh.material] as const,
    )) {
      const selected = faceId === selectedFaceId
      material.color.set(
        selected
          ? SELECTED_FACE_COLOR
          : (faceMaterials[faceId]?.color ?? BASE_FACE_COLOR),
      )
      material.emissive.set(selected ? '#102342' : '#000000')
    }
  }, [faceMaterials, selectedFaceId])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    const poses = solveFoldPoses(
      createCuboidFoldGraph(netLayout, cuboid),
      foldProgress,
    )
    const faces = new Map(cuboid.faces.map((face) => [face.id, face]))
    const transformedCorners = poses.flatMap((pose) => {
      const face = faces.get(pose.faceId as FaceId)!
      return [
        { x: -face.widthMm / 2, y: -face.heightMm / 2, z: 0 },
        { x: face.widthMm / 2, y: -face.heightMm / 2, z: 0 },
        { x: face.widthMm / 2, y: face.heightMm / 2, z: 0 },
        { x: -face.widthMm / 2, y: face.heightMm / 2, z: 0 },
      ].map((point) => transformPoint(pose.transform, point))
    })
    const center = {
      x:
        (Math.min(...transformedCorners.map((point) => point.x)) +
          Math.max(...transformedCorners.map((point) => point.x))) /
        2,
      y:
        (Math.min(...transformedCorners.map((point) => point.y)) +
          Math.max(...transformedCorners.map((point) => point.y))) /
        2,
      z:
        (Math.min(...transformedCorners.map((point) => point.z)) +
          Math.max(...transformedCorners.map((point) => point.z))) /
        2,
    }
    for (const pose of poses) {
      const mesh = preview.faceMeshes.get(pose.faceId as FaceId)
      if (!mesh) continue
      mesh.position.set(
        pose.transform.translation.x - center.x,
        pose.transform.translation.y - center.y,
        pose.transform.translation.z - center.z,
      )
      mesh.quaternion.set(
        pose.transform.rotation.x,
        pose.transform.rotation.y,
        pose.transform.rotation.z,
        pose.transform.rotation.w,
      )
    }
  }, [cuboid, foldProgress, netLayout])

  return (
    <section className="three-preview" aria-label="3D 접힘 시뮬레이션 패널">
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

function cameraFit(preview: PreviewScene, largestDimension: number) {
  preview.camera.near = Math.max(0.01, largestDimension / 1_000)
  preview.camera.far = largestDimension * 30
  preview.camera.position.set(
    largestDimension * 1.8,
    largestDimension * 1.45,
    largestDimension * 2.1,
  )
  preview.camera.lookAt(0, 0, 0)
  preview.camera.updateProjectionMatrix()
  preview.controls.target.set(0, 0, 0)
  preview.controls.minDistance = largestDimension * 0.55
  preview.controls.maxDistance = largestDimension * 12
  preview.controls.update()
}
