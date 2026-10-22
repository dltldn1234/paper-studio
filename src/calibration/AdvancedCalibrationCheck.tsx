import { useState } from 'react'
import type { PrinterProfile } from './printer-profiles'
import { analyzeCalibrationSheetReadings } from './sheet-accuracy'

type Props = { profile: PrinterProfile }

function profileMeasurement(profile: PrinterProfile, axis: 'x' | 'y') {
  return profile[`${axis}Measurements`].find(({ targetMm }) => targetMm === 100)
    ?.measuredMm
}

export function AdvancedCalibrationCheck({ profile }: Props) {
  const [horizontal, setHorizontal] = useState(
    String(profileMeasurement(profile, 'x') ?? ''),
  )
  const [vertical, setVertical] = useState(
    String(profileMeasurement(profile, 'y') ?? ''),
  )
  const [diagonal, setDiagonal] = useState('')
  const [leftRight, setLeftRight] = useState('')
  const [topBottom, setTopBottom] = useState('')
  const hasAllReadings = [
    horizontal,
    vertical,
    diagonal,
    leftRight,
    topBottom,
  ].every((value) => value.trim().length > 0)
  let result: ReturnType<typeof analyzeCalibrationSheetReadings> | null = null
  let inputError = ''
  if (hasAllReadings) {
    try {
      result = analyzeCalibrationSheetReadings({
        horizontalMm: Number(horizontal),
        verticalMm: Number(vertical),
        diagonalMm: Number(diagonal),
        leftRightOffsetMm: Number(leftRight),
        topBottomOffsetMm: Number(topBottom),
      })
    } catch (error) {
      inputError =
        error instanceof Error ? error.message : '실측값을 확인하세요.'
    }
  }

  return (
    <section
      className="calibration-sheet-check"
      aria-label="고급 교정 시트 정확도 검사"
    >
      <div>
        <h4>2 · 정밀 시트 실측 검사</h4>
        <p>
          인쇄한 기준 도형과 위치 마커를 측정해 오차를 계산합니다. 모든 값의
          단위는 mm입니다.
        </p>
      </div>
      <div className="calibration-sheet-check__fields">
        <label>
          X축 100 mm 선 실측값
          <input
            aria-label="정밀 시트 X축 실측값"
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            value={horizontal}
            onChange={(event) => setHorizontal(event.target.value)}
          />
        </label>
        <label>
          Y축 100 mm 선 실측값
          <input
            aria-label="정밀 시트 Y축 실측값"
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            value={vertical}
            onChange={(event) => setVertical(event.target.value)}
          />
        </label>
        <label>
          대각선 실측값 · 목표 141.42 mm
          <input
            aria-label="정밀 시트 대각선 실측값"
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            value={diagonal}
            onChange={(event) => setDiagonal(event.target.value)}
          />
        </label>
        <label>
          좌우 정렬 오차
          <input
            aria-label="정밀 시트 좌우 정렬 오차"
            type="number"
            min="-100"
            max="100"
            step="0.1"
            value={leftRight}
            onChange={(event) => setLeftRight(event.target.value)}
          />
        </label>
        <label>
          상하 정렬 오차
          <input
            aria-label="정밀 시트 상하 정렬 오차"
            type="number"
            min="-100"
            max="100"
            step="0.1"
            value={topBottom}
            onChange={(event) => setTopBottom(event.target.value)}
          />
        </label>
      </div>
      {inputError ? (
        <p className="dimension-error" role="alert">
          {inputError}
        </p>
      ) : result ? (
        <div className="calibration-sheet-check__result" role="status">
          <strong>입력한 실측 오차</strong>
          <span>
            X {result.horizontalErrorMm >= 0 ? '+' : ''}
            {result.horizontalErrorMm.toFixed(2)} mm
          </span>
          <span>
            Y {result.verticalErrorMm >= 0 ? '+' : ''}
            {result.verticalErrorMm.toFixed(2)} mm
          </span>
          <span>
            대각선 {result.diagonalErrorMm >= 0 ? '+' : ''}
            {result.diagonalErrorMm.toFixed(2)} mm
          </span>
          <span>
            좌우 {result.leftRightOffsetMm >= 0 ? '+' : ''}
            {result.leftRightOffsetMm.toFixed(2)} mm · 상하{' '}
            {result.topBottomOffsetMm >= 0 ? '+' : ''}
            {result.topBottomOffsetMm.toFixed(2)} mm
          </span>
          <strong>
            측정 입력 완료 · 프로필의 물리 검증 상태는 별도로 업데이트해야
            합니다.
          </strong>
        </div>
      ) : (
        <p className="export-dialog__note" role="status">
          추가 실측값 입력 전 · 물리 출력 미검증. 입력값은 이 화면에서만
          계산하며 검증 완료로 저장하지 않습니다.
        </p>
      )}
    </section>
  )
}
