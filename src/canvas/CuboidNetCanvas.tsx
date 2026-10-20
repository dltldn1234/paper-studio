import { useId, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import type { FaceId, NetLayout, Point2D } from '../geometry'

type CuboidNetCanvasProps = {
  layout: NetLayout
  selectedFaceId: FaceId | null
  onFaceSelect: (faceId: FaceId) => void
}

type PanGesture = {
  pointerX: number
  pointerY: number
  pan: Point2D
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function pointsToAttribute(points: Point2D[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(' ')
}

export function CuboidNetCanvas({
  layout,
  selectedFaceId,
  onFaceSelect,
}: CuboidNetCanvasProps) {
  const id = useId().replaceAll(':', '')
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 })
  const [gesture, setGesture] = useState<PanGesture | null>(null)
  const { bounds } = layout
  const viewWidth = bounds.width / zoom
  const viewHeight = bounds.height / zoom
  const viewX = bounds.x + pan.x + (bounds.width - viewWidth) / 2
  const viewY = bounds.y + pan.y + (bounds.height - viewHeight) / 2

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    setZoom((current) =>
      clampZoom(current * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
    )
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    const target = event.target as SVGElement
    if (target.dataset.panSurface !== 'true' && target !== event.currentTarget)
      return
    setGesture({ pointerX: event.clientX, pointerY: event.clientY, pan })
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.currentTarget.focus()
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!gesture) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
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
    <div className="net-canvas" data-testid="net-canvas">
      <svg
        ref={svgRef}
        className={`net-canvas__svg${gesture ? 'is-panning' : ''}`}
        role="application"
        aria-label="2D 전개도 캔버스"
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
            id={`${id}-grid`}
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
          fill={`url(#${id}-grid)`}
        />
        {layout.glueTabs.map((tab) => (
          <polygon
            key={tab.id}
            className="net-canvas__tab"
            data-tab-id={tab.id}
            points={pointsToAttribute(tab.polygon.vertices)}
            aria-hidden="true"
          />
        ))}
        {layout.faces.map((face) => (
          <g key={face.id}>
            <polygon
              className={`net-canvas__face${selectedFaceId === face.id ? 'is-selected' : ''}`}
              data-face-id={face.id}
              points={pointsToAttribute(face.polygon.vertices)}
              role="button"
              tabIndex={0}
              aria-label={`${face.label}, ${face.widthMm} × ${face.heightMm} mm`}
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
              x={face.origin.x + face.widthMm / 2}
              y={face.origin.y + face.heightMm / 2 - 2}
              textAnchor="middle"
              aria-hidden="true"
              pointerEvents="none"
            >
              <tspan x={face.origin.x + face.widthMm / 2}>{face.label}</tspan>
              <tspan x={face.origin.x + face.widthMm / 2} dy="5">
                {face.widthMm} × {face.heightMm} mm
              </tspan>
            </text>
          </g>
        ))}
        {layout.edges
          .filter(
            (edge) => !layout.glueTabs.some((tab) => tab.edgeId === edge.id),
          )
          .map((edge) => (
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
        {layout.glueTabs.map((tab) => {
          const edge = layout.edges.find(
            ({ id: edgeId }) => edgeId === tab.edgeId,
          )
          if (!edge) return null
          return (
            <line
              key={`${tab.id}-fold`}
              className="net-canvas__edge is-fold"
              x1={edge.start.x}
              y1={edge.start.y}
              x2={edge.end.x}
              y2={edge.end.y}
              aria-hidden="true"
            />
          )
        })}
      </svg>

      <div className="net-canvas__controls" aria-label="캔버스 확대 및 축소">
        <button
          type="button"
          aria-label="축소"
          onClick={() => setZoom((current) => clampZoom(current / 1.2))}
        >
          <Minus size={15} />
        </button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label="확대"
          onClick={() => setZoom((current) => clampZoom(current * 1.2))}
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
