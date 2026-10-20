import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createCuboidNet } from '../geometry'
import { CuboidNetCanvas } from './CuboidNetCanvas'

const layout = createCuboidNet({ widthMm: 100, depthMm: 80, heightMm: 60 })

describe('CuboidNetCanvas', () => {
  it('renders all six accessible faces and their dimensions', () => {
    render(
      <CuboidNetCanvas
        layout={layout}
        selectedFaceId={null}
        onFaceSelect={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('application', { name: '2D 전개도 캔버스' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(9)
    expect(
      screen.getByRole('button', { name: '앞면, 100 × 60 mm' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '윗면, 100 × 80 mm' }),
    ).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('reports selected faces and supports keyboard activation', () => {
    const onFaceSelect = vi.fn()
    render(
      <CuboidNetCanvas
        layout={layout}
        selectedFaceId="front"
        onFaceSelect={onFaceSelect}
      />,
    )

    const frontFace = screen.getByRole('button', { name: '앞면, 100 × 60 mm' })
    expect(frontFace).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(
      screen.getByRole('button', { name: '윗면, 100 × 80 mm' }),
      {
        key: 'Enter',
      },
    )
    expect(onFaceSelect).toHaveBeenCalledWith('top')
  })

  it('zooms with the controls and wheel and resets to fit', () => {
    render(
      <CuboidNetCanvas
        layout={layout}
        selectedFaceId={null}
        onFaceSelect={vi.fn()}
      />,
    )
    const canvas = screen.getByRole('application', { name: '2D 전개도 캔버스' })

    fireEvent.click(screen.getByRole('button', { name: '확대' }))
    expect(screen.getByText('120%')).toBeInTheDocument()
    fireEvent.wheel(canvas, { deltaY: -100 })
    expect(screen.getByText('138%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '화면 맞춤' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
