import { useId, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import type { Point2D, UnfoldedNet } from '../geometry'

type PolyhedronNetCanvasProps = {
  layout: UnfoldedNet
  selectedFaceId: string | null
  onFaceSelect: (faceId: string) => void
}

type PanGesture = { pointerX: number; pointerY: number; pan: Point2D }

function pointsAttribute(points: Point2D[]) {
  return points.map(({ x, y }) => `${x},${y}`).join(' ')
}

export function PolyhedronNetCanvas({
  layout,
  selectedFaceId,
  onFaceSelect,
}: PolyhedronNetCanvasProps) {
  const patternId = useId().replaceAll(':', '')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 })
  const [gesture, setGesture] = useState<PanGesture | null>(null)
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
              className={`net-canvas__face ${selectedFaceId === face.id ? 'is-selected' : ''}`}
              data-face-id={face.id}
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
        {layout.edges.map((edge) => (
          <line
            key={edge.id}
            className={`net-canvas__edge is-${edge.kind}`}
            x1={edge.start.x}
            y1={edge.start.y}
            x2={edge.end.x}
            y2={edge.end.y}
            aria-hidden="true"
          />
        ))}
      </svg>
      <div className="net-canvas__controls" aria-label="캔버스 확대 및 축소">
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
