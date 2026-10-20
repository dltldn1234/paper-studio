import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Paper Studio shell', () => {
  it('shows the paper design workspace', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: '종이 오브제 만들기' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: '전개도 작업 영역' }),
    ).toBeInTheDocument()
  })
})
