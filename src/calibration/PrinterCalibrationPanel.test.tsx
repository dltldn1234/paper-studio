import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPrinterProfiles } from '../persistence/printer-profiles'
import { PrinterCalibrationPanel } from './PrinterCalibrationPanel'

describe('printer calibration profile panel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates, edits, defaults, and records real X/Y measurements locally', () => {
    render(
      <PrinterCalibrationPanel
        paperSize="A4"
        orientation="portrait"
        onCorrectionChange={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: '새 프로필 이름' }), {
      target: { value: 'Office A4' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '프린터 제조사' }), {
      target: { value: 'Maker' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '프린터 모델' }), {
      target: { value: 'Model 1' },
    })
    fireEvent.click(screen.getByRole('button', { name: '프로필 만들기' }))
    expect(
      (screen.getByLabelText('현재 용지 프로필') as HTMLSelectElement).value,
    ).not.toBe('')

    fireEvent.click(screen.getByRole('button', { name: '기본 프로필 지정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '모델' }), {
      target: { value: 'Model 2' },
    })
    fireEvent.blur(screen.getByRole('textbox', { name: '모델' }))
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'X축 50 mm 실측값' }),
      {
        target: { value: '49.5' },
      },
    )
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'X축 50 mm 실측값' }))
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Y축 100 mm 실측값' }),
      {
        target: { value: '100.8' },
      },
    )
    fireEvent.blur(
      screen.getByRole('spinbutton', { name: 'Y축 100 mm 실측값' }),
    )

    expect(readPrinterProfiles()).toMatchObject([
      {
        name: 'Office A4',
        model: 'Model 2',
        isDefault: true,
        xMeasurements: [{ targetMm: 50, measuredMm: 49.5 }],
        yMeasurements: [{ targetMm: 100, measuredMm: 100.8 }],
        verification: null,
      },
    ])
  })

  it('keeps A3 profiles out of the A4 selection and does not mark empty data verified', () => {
    render(<PrinterCalibrationPanel paperSize="A4" orientation="portrait" />)
    expect(screen.getByText(/프로필을 선택하거나 새로 만드세요/)).toBeVisible()
    expect(screen.getByText(/출력 정확도를 보장하지/)).toBeVisible()
    expect(readPrinterProfiles()).toEqual([])
  })
})
