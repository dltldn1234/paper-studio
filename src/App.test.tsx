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

describe('Paper Studio editor', () => {
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

    const angleInput = screen.getByRole('spinbutton', {
      name: '접착탭 경사각 (도)',
    })
    fireEvent.change(angleInput, { target: { value: '90' } })
    expect(angleInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('15–75°')

    fireEvent.click(screen.getByRole('checkbox', { name: '접착탭 표시' }))
    expect(document.querySelectorAll('[data-tab-id]')).toHaveLength(0)
  })
})
