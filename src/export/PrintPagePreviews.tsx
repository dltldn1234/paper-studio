import type { NetLayout } from '../geometry'
import type { PrintLayout, PrintTile } from './print-layout'

type PrintPagePreviewsProps = {
  net: NetLayout
  layout: PrintLayout
  maxVisiblePages?: number
}

function PrintPagePreview({
  net,
  layout,
  tile,
}: {
  net: NetLayout
  layout: PrintLayout
  tile: PrintTile
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
          {net.edges.map((edge) => {
            const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
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
          {net.glueTabs.map((tab) => (
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
  maxVisiblePages = 8,
}: PrintPagePreviewsProps) {
  const visibleTiles = layout.tiles.slice(0, maxVisiblePages)
  return (
    <div className="print-preview-grid" aria-label="PDF 페이지 미리보기">
      {visibleTiles.map((tile) => (
        <PrintPagePreview
          key={tile.pageNumber}
          net={net}
          layout={layout}
          tile={tile}
        />
      ))}
      {layout.tiles.length > visibleTiles.length && (
        <p className="print-preview-more">
          외 {layout.tiles.length - visibleTiles.length}페이지
        </p>
      )}
    </div>
  )
}
