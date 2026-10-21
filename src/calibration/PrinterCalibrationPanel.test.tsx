import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPrinterProfiles } from '../persistence/printer-profiles'
import { PrinterCalibrationPanel } from './PrinterCalibrationPanel'

describe('printer calibration profile panel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates, edits, defaults, and records real X/Y measurements locally', () => {
    const onCorrectionChange = vi.fn()
    render(
      <PrinterCalibrationPanel
        paperSize="A4"
        orientation="portrait"
        onCorrectionChange={onCorrectionChange}
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
      screen.getByRole('spinbutton', { name: 'X축 100 mm 실측값' }),
      { target: { value: '99' } },
    )
    fireEvent.blur(
      screen.getByRole('spinbutton', { name: 'X축 100 mm 실측값' }),
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Y축 100 mm 실측값' }),
      {
        target: { value: '100.8' },
      },
    )
    fireEvent.blur(
      screen.getByRole('spinbutton', { name: 'Y축 100 mm 실측값' }),
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Y축 50 mm 실측값' }),
      { target: { value: '50.5' } },
    )
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'Y축 50 mm 실측값' }))

    const storedProfile = readPrinterProfiles()[0]
    expect(storedProfile.correction?.xScale).toBeCloseTo(100 / 99)
    expect(storedProfile.correction?.yScale).toBeCloseTo(
      (50 / 50.5 + 100 / 100.8) / 2,
    )
    const applyCheckbox = screen.getByRole('checkbox', {
      name: '이 프로필의 보정 배율 PDF에 적용',
    })
    expect(applyCheckbox).not.toBeChecked()
    fireEvent.click(applyCheckbox)
    expect(onCorrectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profileId: storedProfile.id,
        profileName: 'Office A4',
        xScale: expect.any(Number),
        yScale: expect.any(Number),
      }),
    )

    for (const [axis, targetMm, measuredMm] of [
      ['x', 50, 50],
      ['x', 100, 100],
      ['y', 50, 50],
      ['y', 100, 100],
    ] as const) {
      const measurement = screen.getByRole('spinbutton', {
        name: `${axis.toUpperCase()}축 보정 후 ${targetMm} mm 실측값`,
      })
      fireEvent.change(measurement, { target: { value: String(measuredMm) } })
      fireEvent.blur(measurement)
    }
    expect(readPrinterProfiles()[0].verification).toMatchObject({
      physicallyMeasured: false,
      status: 'needs-review',
    })
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: '실제 재출력물을 자로 측정했습니다',
      }),
    )

    expect(readPrinterProfiles()).toMatchObject([
      {
        name: 'Office A4',
        model: 'Model 2',
        isDefault: true,
        xMeasurements: [
          { targetMm: 50, measuredMm: 49.5 },
          { targetMm: 100, measuredMm: 99 },
        ],
        yMeasurements: [
          { targetMm: 100, measuredMm: 100.8 },
          { targetMm: 50, measuredMm: 50.5 },
        ],
        verification: {
          physicallyMeasured: true,
          status: 'verified',
        },
      },
    ])
  })

  it('keeps A3 profiles out of the A4 selection and does not mark empty data verified', () => {
    render(<PrinterCalibrationPanel paperSize="A4" orientation="portrait" />)
    expect(screen.getByText(/프로필을 선택하거나 새로 만드세요/)).toBeVisible()
    expect(screen.getByText(/출력 정확도를 보장하지/)).toBeVisible()
    expect(readPrinterProfiles()).toEqual([])
  })

  it('lets users move an existing profile to a different paper size', () => {
    render(<PrinterCalibrationPanel paperSize="A4" orientation="portrait" />)
    fireEvent.change(screen.getByRole('textbox', { name: '새 프로필 이름' }), {
      target: { value: 'Move to A3' },
    })
    fireEvent.click(screen.getByRole('button', { name: '프로필 만들기' }))
    fireEvent.change(screen.getByRole('combobox', { name: '용지 크기' }), {
      target: { value: 'A3' },
    })
    expect(readPrinterProfiles()).toMatchObject([
      { name: 'Move to A3', paperSize: 'A3', orientation: 'portrait' },
    ])
  })

  it('lets users update the print orientation on an existing profile', () => {
    render(<PrinterCalibrationPanel paperSize="A4" orientation="portrait" />)
    fireEvent.change(screen.getByRole('textbox', { name: '새 프로필 이름' }), {
      target: { value: 'Rotate A4' },
    })
    fireEvent.click(screen.getByRole('button', { name: '프로필 만들기' }))
    fireEvent.change(screen.getByRole('combobox', { name: '방향' }), {
      target: { value: 'landscape' },
    })
    expect(readPrinterProfiles()).toMatchObject([
      { name: 'Rotate A4', paperSize: 'A4', orientation: 'landscape' },
    ])
  })
})
