import type { PrintableNet } from './printable-net'
import type { PrintLayout, PrintTile } from './print-layout'
import type { FaceMaterial } from '../materials/materials'

type PrintPagePreviewsProps = {
  net: PrintableNet
  layout: PrintLayout
  faceMaterials?: Record<string, FaceMaterial>
  maxVisiblePages?: number
}

function PrintPagePreview({
  net,
  layout,
  tile,
  faceMaterials,
}: {
  net: PrintableNet
  layout: PrintLayout
  tile: PrintTile
  faceMaterials?: Record<string, FaceMaterial>
}) {
  const margin = layout.settings.marginMm
  const pageWidth = layout.pageWidthMm
  const pageHeight = layout.pageHeightMm
  const tabbedEdgeIds = new Set(net.glueTabs.map((tab) => tab.edgeId))
  const transform = `translate(${margin - tile.origin.x} ${margin - tile.origin.y})`

  return (
    <figure className="print-preview-tile">
      <svg
        className="print-preview-page"
        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
        role="img"
        aria-label={`PDF ${tile.pageNumber}페이지 미리보기, ${layout.tiles.length}페이지 중 ${tile.pageNumber}페이지`}
      >
        <rect x="0" y="0" width={pageWidth} height={pageHeight} />
        <rect
          className="print-preview-page__printable"
          x={margin}
          y={margin}
          width={layout.printableWidthMm}
          height={layout.printableHeightMm}
        />
        <g transform={transform} className="print-preview-pattern">
          {net.faces.map((face, index) => {
            const material = faceMaterials?.[face.id]
            const texture = material?.texture
            const xs = face.polygon.map(({ x }) => x)
            const ys = face.polygon.map(({ y }) => y)
            const width = Math.max(...xs) - Math.min(...xs)
            const height = Math.max(...ys) - Math.min(...ys)
            return (
              <g key={face.id}>
                {texture && (
                  <defs>
                    <pattern
                      id={`print-preview-texture-${index}`}
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
                  </defs>
                )}
                <polygon
                  points={face.polygon.map(({ x, y }) => `${x},${y}`).join(' ')}
                  fill={
                    texture
                      ? `url(#print-preview-texture-${index})`
                      : (material?.color ?? 'none')
                  }
                />
              </g>
            )
          })}
          {net.edges.map((edge) => {
            const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
            if (
              (kind === 'cut' && layout.settings.showCutLines === false) ||
              (kind === 'fold' && layout.settings.showFoldLines === false)
            ) {
              return null
            }
            return (
              <line
                key={edge.id}
                className={`print-preview-pattern__${kind}`}
                x1={edge.start.x}
                y1={edge.start.y}
                x2={edge.end.x}
                y2={edge.end.y}
              />
            )
          })}
          {layout.settings.showCutLines === false
            ? null
            : net.glueTabs.map((tab) => (
                <polyline
                  key={tab.id}
                  className="print-preview-pattern__cut"
                  points={[
                    ...tab.polygon.vertices.slice(1),
                    tab.polygon.vertices[0],
                  ]
                    .map(({ x, y }) => `${x},${y}`)
                    .join(' ')}
                />
              ))}
          {layout.settings.showAssemblyNumbers === false
            ? null
            : net.faces.map((face, index) => {
                const center = face.polygon.reduce(
                  (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
                  { x: 0, y: 0 },
                )
                const x = center.x / face.polygon.length
                const y = center.y / face.polygon.length
                return (
                  <text
                    key={face.id}
                    className="print-preview-pattern__face-number"
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {index + 1}
                  </text>
                )
              })}
        </g>
        <g className="print-preview-guides">
          {tile.guides.map(({ id, point }) => {
            const x = margin + point.x - tile.origin.x
            const y = margin + point.y - tile.origin.y
            return (
              <path
                key={id}
                d={`M ${x - 1.5} ${y} H ${x + 1.5} M ${x} ${y - 1.5} V ${y + 1.5}`}
              />
            )
          })}
        </g>
      </svg>
      <figcaption>
        {tile.pageNumber} · R{tile.row} C{tile.column}
      </figcaption>
    </figure>
  )
}

export function PrintPagePreviews({
  net,
  layout,
  faceMaterials,
  maxVisiblePages = 8,
}: PrintPagePreviewsProps) {
  const visibleTiles = layout.tiles.slice(0, Math.max(0, maxVisiblePages - 1))
  return (
    <div className="print-preview-grid" aria-label="PDF 페이지 미리보기">
      {visibleTiles.map((tile) => (
        <PrintPagePreview
          key={tile.pageNumber}
          net={net}
          layout={layout}
          tile={tile}
          faceMaterials={faceMaterials}
        />
      ))}
      <figure className="print-preview-tile">
        <svg
          className="print-preview-page"
          viewBox={`0 0 ${layout.pageWidthMm} ${layout.pageHeightMm}`}
          role="img"
          aria-label={`PDF 교정 페이지 미리보기, ${layout.tiles.length + 1}페이지 중 마지막`}
        >
          <rect
            x="0"
            y="0"
            width={layout.pageWidthMm}
            height={layout.pageHeightMm}
          />
          <rect
            className="print-preview-page__printable"
            x={layout.settings.marginMm}
            y={layout.settings.marginMm}
            width={layout.printableWidthMm}
            height={layout.printableHeightMm}
          />
          <g className="print-preview-calibration">
            <rect
              x={layout.settings.marginMm + 20}
              y={layout.settings.marginMm + 20}
              width="100"
              height="100"
            />
            <line
              x1={layout.settings.marginMm + 20}
              y1={layout.settings.marginMm + 130}
              x2={layout.settings.marginMm + 120}
              y2={layout.settings.marginMm + 130}
            />
            <text
              x={layout.settings.marginMm + 20}
              y={layout.settings.marginMm + 140}
            >
              100 mm
            </text>
          </g>
        </svg>
        <figcaption>교정 · 100%</figcaption>
      </figure>
      {layout.tiles.length > visibleTiles.length && (
        <p className="print-preview-more">
          외 {layout.tiles.length - visibleTiles.length} 도면 페이지
        </p>
      )}
    </div>
  )
}
