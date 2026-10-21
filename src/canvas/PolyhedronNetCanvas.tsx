import { useId, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { Minus, Plus, Redo2, RotateCcw, Scan, Undo2 } from 'lucide-react'
import type { Point2D, UnfoldedNet } from '../geometry'
import type { FaceMaterial } from '../materials/materials'

type PolyhedronNetCanvasProps = {
  layout: UnfoldedNet
  faceMaterials?: Record<string, FaceMaterial>
  selectedFaceId: string | null
  assemblyFaceId?: string | null
  onFaceSelect: (faceId: string) => void
  foldEdgeIds: string[]
  selectedEdgeId: string | null
  onEdgeToggle: (edgeId: string) => void
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  canUndo: boolean
  canRedo: boolean
}

type PanGesture = { pointerX: number; pointerY: number; pan: Point2D }

function pointsAttribute(points: Point2D[]) {
  return points.map(({ x, y }) => `${x},${y}`).join(' ')
}

export function PolyhedronNetCanvas({
  layout,
  faceMaterials = {},
  selectedFaceId,
  assemblyFaceId = null,
  onFaceSelect,
  foldEdgeIds,
  selectedEdgeId,
  onEdgeToggle,
  onUndo,
  onRedo,
  onReset,
  canUndo,
  canRedo,
}: PolyhedronNetCanvasProps) {
  const patternId = useId().replaceAll(':', '')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 })
  const [gesture, setGesture] = useState<PanGesture | null>(null)
  const texturePatternIds = new Map(
    layout.faces.map((face, index) => [
      face.id,
      `${patternId}-texture-${index}`,
    ]),
  )
  const { x, y, width, height } = layout.bounds
  const viewWidth = width / zoom
  const viewHeight = height / zoom
  const viewX = x + pan.x + (width - viewWidth) / 2
  const viewY = y + pan.y + (height - viewHeight) / 2

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    setZoom((current) =>
      Math.min(
        4,
        Math.max(0.5, current * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
      ),
    )
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    const target = event.target as SVGElement
    if (target.dataset.panSurface !== 'true' && target !== event.currentTarget)
      return
    setGesture({ pointerX: event.clientX, pointerY: event.clientY, pan })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!gesture) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    setPan({
      x:
        gesture.pan.x -
        ((event.clientX - gesture.pointerX) * viewWidth) / rect.width,
      y:
        gesture.pan.y -
        ((event.clientY - gesture.pointerY) * viewHeight) / rect.height,
    })
  }

  return (
    <div className="net-canvas" data-testid="polyhedron-net-canvas">
      <svg
        className={`net-canvas__svg${gesture ? 'is-panning' : ''}`}
        role="application"
        aria-label="다면체 2D 전개도 캔버스"
        tabIndex={0}
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setGesture(null)}
        onPointerCancel={() => setGesture(null)}
      >
        <defs>
          <pattern
            id={`${patternId}-grid`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r="0.45" fill="#667085" opacity="0.45" />
          </pattern>
          {layout.faces.map((face) => {
            const texture = faceMaterials[face.id]?.texture
            const id = texturePatternIds.get(face.id)
            if (!texture || !id) return null
            const xs = face.polygon.map(({ x }) => x)
            const ys = face.polygon.map(({ y }) => y)
            const width = Math.max(...xs) - Math.min(...xs)
            const height = Math.max(...ys) - Math.min(...ys)
            return (
              <pattern
                key={id}
                id={id}
                width={width * texture.scale}
                height={height * texture.scale}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${texture.offsetX} ${texture.offsetY}) rotate(${texture.rotationDeg})`}
              >
                <image
                  href={texture.dataUrl}
                  width={width}
                  height={height}
                  preserveAspectRatio="none"
                />
              </pattern>
            )
          })}
        </defs>
        <rect
          data-pan-surface="true"
          x={viewX - viewWidth}
          y={viewY - viewHeight}
          width={viewWidth * 3}
          height={viewHeight * 3}
          fill={`url(#${patternId}-grid)`}
        />
        {layout.faces.map((face) => (
          <g key={face.id}>
            <polygon
              className={`net-canvas__face ${selectedFaceId === face.id ? 'is-selected' : ''} ${assemblyFaceId === face.id ? 'is-assembly-target' : ''}`}
              data-face-id={face.id}
              style={{
                fill: faceMaterials[face.id]?.texture
                  ? `url(#${texturePatternIds.get(face.id)})`
                  : faceMaterials[face.id]?.color,
              }}
              points={pointsAttribute(face.polygon)}
              role="button"
              tabIndex={0}
              aria-label={`${face.label}, ${face.polygon.length}개 꼭짓점`}
              aria-pressed={selectedFaceId === face.id}
              onClick={() => onFaceSelect(face.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onFaceSelect(face.id)
                }
              }}
            />
            <text
              className="net-canvas__face-label"
              x={
                face.polygon.reduce((sum, point) => sum + point.x, 0) /
                face.polygon.length
              }
              y={
                face.polygon.reduce((sum, point) => sum + point.y, 0) /
                face.polygon.length
              }
              textAnchor="middle"
              aria-hidden="true"
              pointerEvents="none"
            >
              {face.label}
            </text>
          </g>
        ))}
        {layout.edges.map((edge) => {
          const kind = foldEdgeIds.includes(edge.id) ? 'fold' : 'cut'
          const lengthMm = Math.hypot(
            edge.end.x - edge.start.x,
            edge.end.y - edge.start.y,
          )
          return (
            <g key={edge.id}>
              <line
                className="net-canvas__edge-hit"
                data-edge-id={edge.id}
                data-edge-kind={kind}
                x1={edge.start.x}
                y1={edge.start.y}
                x2={edge.end.x}
                y2={edge.end.y}
                role="button"
                tabIndex={0}
                aria-label={`${kind === 'fold' ? '접힘선' : '재단선'}, ${lengthMm.toFixed(1)} mm`}
                aria-pressed={selectedEdgeId === edge.id}
                onClick={() => onEdgeToggle(edge.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onEdgeToggle(edge.id)
                  }
                }}
              >
                <title>{`${kind === 'fold' ? '접힘선' : '재단선'} · ${lengthMm.toFixed(1)} mm · 선택하여 전환`}</title>
              </line>
              <line
                className={`net-canvas__edge is-${kind}${selectedEdgeId === edge.id ? 'is-selected' : ''}`}
                x1={edge.start.x}
                y1={edge.start.y}
                x2={edge.end.x}
                y2={edge.end.y}
                aria-hidden="true"
              />
            </g>
          )
        })}
      </svg>
      <div className="net-canvas__controls" aria-label="캔버스 확대 및 축소">
        <button
          type="button"
          aria-label="전개도 변경 취소"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          aria-label="전개도 변경 다시 실행"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={15} />
        </button>
        <button type="button" aria-label="자동 전개 복원" onClick={onReset}>
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          aria-label="축소"
          onClick={() => setZoom((current) => Math.max(0.5, current / 1.2))}
        >
          <Minus size={15} />
        </button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label="확대"
          onClick={() => setZoom((current) => Math.min(4, current * 1.2))}
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          aria-label="화면 맞춤"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
        >
          <Scan size={15} />
        </button>
      </div>
      <span className="net-canvas__hint">
        드래그하여 이동 · 스크롤하여 확대
      </span>
    </div>
  )
}
