import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./preview/ThreeCuboidPreview', () => ({
  ThreeCuboidPreview: ({
    cuboid,
    selectedFaceId,
    onFaceSelect,
  }: {
    cuboid: { dimensions: { widthMm: number } }
    selectedFaceId: string | null
    onFaceSelect: (faceId: 'top') => void
  }) => (
    <button
      type="button"
      data-testid="preview-probe"
      data-width={cuboid.dimensions.widthMm}
      data-selected-face={selectedFaceId ?? ''}
      onClick={() => onFaceSelect('top')}
    >
      Mock 3D preview
    </button>
  ),
}))
vi.mock('./preview/ThreePolyhedronPreview', () => ({
  ThreePolyhedronPreview: ({
    layout,
    selectedFaceId,
    onFaceSelect,
  }: {
    layout: { faces: Array<{ id: string }> }
    selectedFaceId: string | null
    onFaceSelect: (faceId: string) => void
  }) => (
    <button
      type="button"
      data-testid="polyhedron-preview-probe"
      data-face-count={layout.faces.length}
      data-selected-face={selectedFaceId ?? ''}
      onClick={() => onFaceSelect(layout.faces[0].id)}
    >
      Mock polyhedron preview
    </button>
  ),
}))

describe('Paper Studio editor', () => {
  it('edits a valid fold tree, rejects an incomplete draft, and supports undo and redo', async () => {
    render(<App />)
    fireEvent.change(screen.getByRole('combobox', { name: '다면체 종류' }), {
      target: { value: 'tetrahedron' },
    })
    await screen.findByRole('application', {
      name: '다면체 2D 전개도 캔버스',
    })

    const initialFoldIds = Array.from(
      document.querySelectorAll('[data-edge-kind="fold"]'),
    ).map((edge) => edge.getAttribute('data-edge-id'))
    expect(initialFoldIds).toHaveLength(3)
    fireEvent.click(document.querySelector('[data-edge-kind="cut"]')!)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '접힘선을 3개 선택해야 합니다. 현재 4개입니다.',
    )
    expect(screen.getByTestId('polyhedron-preview-probe')).toHaveAttribute(
      'data-face-count',
      '4',
    )

    fireEvent.click(document.querySelector('[data-edge-kind="fold"]')!)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    const changedFoldIds = Array.from(
      document.querySelectorAll('[data-edge-kind="fold"]'),
    ).map((edge) => edge.getAttribute('data-edge-id'))
    expect(changedFoldIds).toHaveLength(3)
    expect(changedFoldIds).not.toEqual(initialFoldIds)

    fireEvent.click(screen.getByRole('button', { name: '전개도 변경 취소' }))
    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('[data-edge-kind="fold"]')).map(
          (edge) => edge.getAttribute('data-edge-id'),
        ),
      ).toEqual(initialFoldIds)
    })
    fireEvent.click(
      screen.getByRole('button', { name: '전개도 변경 다시 실행' }),
    )
    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('[data-edge-kind="fold"]')).map(
          (edge) => edge.getAttribute('data-edge-id'),
        ),
      ).toEqual(changedFoldIds)
    })
  })

  it('selects a polyhedron and synchronizes its net, edge length, and selected face', async () => {
    render(<App />)
    fireEvent.change(screen.getByRole('combobox', { name: '다면체 종류' }), {
      target: { value: 'tetrahedron' },
    })

    expect(
      await screen.findByRole('application', {
        name: '다면체 2D 전개도 캔버스',
      }),
    ).toBeInTheDocument()
    const preview = await screen.findByTestId('polyhedron-preview-probe')
    expect(preview).toHaveAttribute('data-face-count', '4')
    const edgeLength = screen.getByRole('spinbutton', {
      name: '모서리 길이 (mm)',
    })
    fireEvent.change(edgeLength, { target: { value: '125' } })
    expect(screen.getByText(/모서리 125 mm/)).toBeInTheDocument()

    const face = screen.getAllByRole('button', { name: /face-/ })[1]
    fireEvent.click(face)
    expect(face).toHaveAttribute('aria-pressed', 'true')
    expect(preview).toHaveAttribute(
      'data-selected-face',
      face.getAttribute('data-face-id'),
    )
  })

  it('rejects invalid polyhedron edge lengths without changing the active model', async () => {
    render(<App />)
    fireEvent.change(screen.getByRole('combobox', { name: '다면체 종류' }), {
      target: { value: 'octahedron' },
    })
    const edgeLength = await screen.findByRole('spinbutton', {
      name: '모서리 길이 (mm)',
    })
    fireEvent.change(edgeLength, { target: { value: '0' } })
    expect(edgeLength).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('0.1–10,000 mm')
    expect(
      await screen.findByTestId('polyhedron-preview-probe'),
    ).toHaveAttribute('data-face-count', '8')
  })

  it('starts with the standard cuboid and the synchronized 2D and 3D views', async () => {
    render(<App />)

    expect(screen.getByRole('spinbutton', { name: '너비 (mm)' })).toHaveValue(
      100,
    )
    expect(screen.getByRole('spinbutton', { name: '깊이 (mm)' })).toHaveValue(
      80,
    )
    expect(screen.getByRole('spinbutton', { name: '높이 (mm)' })).toHaveValue(
      60,
    )
    expect(
      screen.getByRole('application', { name: '2D 전개도 캔버스' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '앞면, 100 × 60 mm' }),
    ).toHaveAttribute('aria-pressed', 'true')
    const preview = await screen.findByTestId('preview-probe')
    expect(preview).toHaveAttribute('data-width', '100')
    expect(preview).toHaveAttribute('data-selected-face', 'front')
  })

  it('updates the model, net, preview, and status when a valid dimension changes', async () => {
    render(<App />)
    fireEvent.change(screen.getByRole('spinbutton', { name: '너비 (mm)' }), {
      target: { value: '125' },
    })

    expect(
      screen.getByRole('button', { name: '앞면, 125 × 60 mm' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('preview-probe')).toHaveAttribute(
        'data-width',
        '125',
      ),
    )
    expect(screen.getByText(/W 125/)).toBeInTheDocument()
  })

  it('rejects invalid dimensions and keeps the last valid model', async () => {
    render(<App />)
    const widthInput = screen.getByRole('spinbutton', { name: '너비 (mm)' })
    fireEvent.change(widthInput, { target: { value: '0' } })

    expect(widthInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('0.1 mm 이상')
    await waitFor(() =>
      expect(screen.getByTestId('preview-probe')).toHaveAttribute(
        'data-width',
        '100',
      ),
    )
    expect(
      screen.getByRole('button', { name: '앞면, 100 × 60 mm' }),
    ).toBeInTheDocument()
  })

  it('synchronizes face selection in both directions', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '윗면, 100 × 80 mm' }))
    const preview = await screen.findByTestId('preview-probe')
    expect(preview).toHaveAttribute('data-selected-face', 'top')

    fireEvent.click(preview)
    expect(
      screen.getByRole('button', { name: '윗면, 100 × 80 mm' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('supports keyboard resizing of the side panels', () => {
    render(<App />)
    const sidebarSplitter = screen.getByRole('separator', {
      name: '프로젝트 패널 너비 조절',
    })
    fireEvent.keyDown(sidebarSplitter, { key: 'ArrowRight' })

    expect(sidebarSplitter).toHaveAttribute('aria-valuenow', '244')
  })

  it('shows configurable glue tabs and rejects out-of-range options', () => {
    render(<App />)
    expect(document.querySelectorAll('[data-tab-id]')).toHaveLength(7)
    const firstTab = document.querySelector('[data-tab-id]')
    const initialTabPoints = firstTab?.getAttribute('points')

    fireEvent.change(
      screen.getByRole('spinbutton', { name: '접착탭 너비 (mm)' }),
      {
        target: { value: '12' },
      },
    )
    expect(firstTab?.getAttribute('points')).not.toBe(initialTabPoints)

    const shapeSelect = screen.getByRole('combobox', { name: '접착탭 형태' })
    const beforeShapeChange = firstTab?.getAttribute('points')
    fireEvent.change(shapeSelect, { target: { value: 'rectangular' } })
    expect(firstTab?.getAttribute('points')).not.toBe(beforeShapeChange)
    const firstEdgeTab = screen.getAllByRole('checkbox', {
      name: /접착탭$/,
    })[0]
    fireEvent.click(firstEdgeTab)
    expect(document.querySelectorAll('[data-tab-id]')).toHaveLength(6)
    fireEvent.change(screen.getByRole('combobox', { name: '접착탭 방향' }), {
      target: { value: 'inward' },
    })
    expect(firstTab?.getAttribute('points')).not.toBe(beforeShapeChange)

    const angleInput = screen.getByRole('spinbutton', {
      name: '접착탭 경사각 (도)',
    })
    fireEvent.change(angleInput, { target: { value: '90' } })
    expect(angleInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('15–75°')

    fireEvent.click(screen.getByRole('checkbox', { name: '접착탭 표시' }))
    expect(document.querySelectorAll('[data-tab-id]')).toHaveLength(0)
  })

  it('applies a selected face color to the net editor', () => {
    render(<App />)
    const face = document.querySelector('[data-face-id="front"]')
    fireEvent.change(screen.getByLabelText('선택 면 색상'), {
      target: { value: '#aabbcc' },
    })
    expect(face).toHaveStyle({ fill: '#aabbcc' })
  })

  it('loads a local texture and exposes its transform controls', async () => {
    render(<App />)
    const image = new File(['local texture'], 'texture.png', {
      type: 'image/png',
    })
    fireEvent.change(screen.getByLabelText('로컬 이미지 텍스처'), {
      target: { files: [image] },
    })

    expect(await screen.findByLabelText('텍스처 크기')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        document.querySelector('[data-face-id="front"]')?.getAttribute('style'),
      ).toContain('url(')
    })
  })
})
