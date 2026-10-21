import { useEffect, useMemo, useState } from 'react'
import { createPrinterProfile, type PrinterProfile } from './printer-profiles'
import {
  deletePrinterProfile,
  exportPrinterProfiles,
  importPrinterProfiles,
  readPrinterProfiles,
  savePrinterProfile,
  setDefaultPrinterProfile,
} from '../persistence/printer-profiles'
import type { PageOrientation, PaperSize } from '../export/print-layout'
import {
  analyzeCalibrationAxis,
  compareCalibrationMeasurement,
} from './precision'

const TARGETS = [50, 100, 150] as const

export type PrinterCorrectionSelection = {
  profileId: string
  profileName: string
  xScale: number
  yScale: number
}

type PrinterCalibrationPanelProps = {
  paperSize: PaperSize
  orientation: PageOrientation
  onCorrectionChange?: (selection: PrinterCorrectionSelection | null) => void
}

function profileSummary(profile: PrinterProfile) {
  const model = [profile.manufacturer, profile.model].filter(Boolean).join(' ')
  return model || '프린터 정보 없음'
}

export function PrinterCalibrationPanel({
  paperSize,
  orientation,
  onCorrectionChange,
}: PrinterCalibrationPanelProps) {
  const [profiles, setProfiles] = useState(() => readPrinterProfiles())
  const [selectedProfileId, setSelectedProfileId] = useState(
    () =>
      readPrinterProfiles().find(
        (profile) =>
          profile.paperSize === paperSize &&
          profile.orientation === orientation &&
          profile.isDefault,
      )?.id ?? '',
  )
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [driverInfo, setDriverInfo] = useState('')
  const [includedCorrectionProfileId, setIncludedCorrectionProfileId] =
    useState<string | null>(null)
  const [measurementDrafts, setMeasurementDrafts] = useState<
    Record<string, string>
  >({})
  const [verificationDrafts, setVerificationDrafts] = useState<
    Record<string, string>
  >({})
  const [physicalConfirmationProfileId, setPhysicalConfirmationProfileId] =
    useState<string | null>(null)
  const [profileDrafts, setProfileDrafts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const profile = useMemo(() => {
    const selected = profiles.find((item) => item.id === selectedProfileId)
    return selected?.paperSize === paperSize &&
      selected.orientation === orientation
      ? selected
      : (profiles.find(
          (item) =>
            item.paperSize === paperSize &&
            item.orientation === orientation &&
            item.isDefault,
        ) ?? null)
  }, [orientation, paperSize, profiles, selectedProfileId])
  const correction = profile?.correction ?? null
  const xAnalysis = profile
    ? analyzeCalibrationAxis(profile.xMeasurements)
    : null
  const yAnalysis = profile
    ? analyzeCalibrationAxis(profile.yMeasurements)
    : null

  useEffect(() => {
    onCorrectionChange?.(
      includedCorrectionProfileId === profile?.id && profile && correction
        ? {
            profileId: profile.id,
            profileName: profile.name,
            xScale: correction.xScale,
            yScale: correction.yScale,
          }
        : null,
    )
  }, [correction, includedCorrectionProfileId, onCorrectionChange, profile])

  function refresh(nextSelectedId = selectedProfileId) {
    setProfiles(readPrinterProfiles())
    setSelectedProfileId(nextSelectedId)
  }

  function createProfile() {
    setError('')
    try {
      if (!name.trim()) throw new RangeError('프로필 이름을 입력하세요.')
      const created = createPrinterProfile({
        name,
        manufacturer,
        model,
        driverInfo,
        paperSize,
        orientation,
      })
      if (!savePrinterProfile(created)) {
        throw new Error('프로필을 브라우저 저장소에 저장하지 못했습니다.')
      }
      setName('')
      setManufacturer('')
      setModel('')
      setDriverInfo('')
      setMessage(`${created.name} 프로필을 만들었습니다.`)
      refresh(created.id)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '프로필을 만들지 못했습니다.',
      )
    }
  }

  function saveMeasurement(
    axis: 'x' | 'y',
    targetMm: (typeof TARGETS)[number],
    value: string,
  ) {
    if (!profile) return
    const draftKey = `${profile.id}-${axis}-${targetMm}`
    setMeasurementDrafts((current) => ({ ...current, [draftKey]: value }))
    if (!value.trim()) {
      const next = {
        ...profile,
        [`${axis}Measurements`]: profile[`${axis}Measurements`].filter(
          (measurement) => measurement.targetMm !== targetMm,
        ),
        updatedAt: new Date().toISOString(),
      }
      const xAnalysis = analyzeCalibrationAxis(
        axis === 'x' ? next.xMeasurements : profile.xMeasurements,
      )
      const yAnalysis = analyzeCalibrationAxis(
        axis === 'y' ? next.yMeasurements : profile.yMeasurements,
      )
      next.correction =
        xAnalysis.status === 'ready' &&
        yAnalysis.status === 'ready' &&
        xAnalysis.correctionScale !== null &&
        yAnalysis.correctionScale !== null
          ? {
              xScale: xAnalysis.correctionScale,
              yScale: yAnalysis.correctionScale,
            }
          : null
      next.verification = null
      setPhysicalConfirmationProfileId(null)
      if (savePrinterProfile(next)) refresh(profile.id)
      return
    }
    const measuredMm = Number(value)
    if (
      !Number.isFinite(measuredMm) ||
      measuredMm <= 0 ||
      measuredMm > targetMm * 2
    ) {
      setError('실측값은 0보다 크고 기준 길이의 2배 이하여야 합니다.')
      return
    }
    setError('')
    const measurements = profile[`${axis}Measurements`].filter(
      (measurement) => measurement.targetMm !== targetMm,
    )
    measurements.push({ targetMm, measuredMm })
    const next = {
      ...profile,
      [`${axis}Measurements`]: measurements,
      measuredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const xAnalysis = analyzeCalibrationAxis(
      axis === 'x' ? measurements : profile.xMeasurements,
    )
    const yAnalysis = analyzeCalibrationAxis(
      axis === 'y' ? measurements : profile.yMeasurements,
    )
    next.correction =
      xAnalysis.status === 'ready' &&
      yAnalysis.status === 'ready' &&
      xAnalysis.correctionScale !== null &&
      yAnalysis.correctionScale !== null
        ? {
            xScale: xAnalysis.correctionScale,
            yScale: yAnalysis.correctionScale,
          }
        : null
    next.verification = null
    setPhysicalConfirmationProfileId(null)
    if (!savePrinterProfile(next)) {
      setError('실측값을 로컬 저장소에 기록하지 못했습니다.')
      return
    }
    refresh(profile.id)
    setMessage(`${axis.toUpperCase()}축 ${targetMm} mm 실측값을 저장했습니다.`)
  }

  function saveVerificationMeasurement(
    axis: 'x' | 'y',
    targetMm: (typeof TARGETS)[number],
    value: string,
  ) {
    if (!profile?.correction) return
    const draftKey = `${profile.id}-${axis}-${targetMm}`
    setVerificationDrafts((current) => ({ ...current, [draftKey]: value }))
    const oldVerification = profile.verification
    const currentMeasurements = oldVerification?.[`${axis}Measurements`] ?? []
    let measurements = currentMeasurements.filter(
      (measurement) => measurement.targetMm !== targetMm,
    )
    if (value.trim()) {
      const measuredMm = Number(value)
      if (
        !Number.isFinite(measuredMm) ||
        measuredMm <= 0 ||
        measuredMm > targetMm * 2
      ) {
        setError('검증 실측값은 0보다 크고 기준 길이의 2배 이하여야 합니다.')
        return
      }
      measurements = [...measurements, { targetMm, measuredMm }]
    }
    const xMeasurements =
      axis === 'x' ? measurements : (oldVerification?.xMeasurements ?? [])
    const yMeasurements =
      axis === 'y' ? measurements : (oldVerification?.yMeasurements ?? [])
    const xAnalysis = analyzeCalibrationAxis(xMeasurements)
    const yAnalysis = analyzeCalibrationAxis(yMeasurements)
    const physicallyMeasured =
      oldVerification?.physicallyMeasured ??
      physicalConfirmationProfileId === profile.id
    const verified =
      physicallyMeasured &&
      xAnalysis.status === 'ready' &&
      yAnalysis.status === 'ready' &&
      xAnalysis.correctionScale !== null &&
      yAnalysis.correctionScale !== null &&
      Math.abs(xAnalysis.correctionScale - 1) <= 0.01 &&
      Math.abs(yAnalysis.correctionScale - 1) <= 0.01
    const next = {
      ...profile,
      updatedAt: new Date().toISOString(),
      verification:
        xMeasurements.length || yMeasurements.length
          ? {
              measuredAt: new Date().toISOString(),
              xMeasurements,
              yMeasurements,
              physicallyMeasured,
              status: verified
                ? ('verified' as const)
                : ('needs-review' as const),
            }
          : null,
    }
    if (!savePrinterProfile(next)) {
      setError('검증 실측값을 로컬 저장소에 기록하지 못했습니다.')
      return
    }
    setError('')
    refresh(profile.id)
    setMessage(
      verified
        ? '실제 재출력 측정값이 두 축에서 허용 오차 안에 있습니다.'
        : '재출력 측정값을 저장했습니다. 두 축의 2개 이상 기준 길이가 필요하고 1% 허용 오차를 확인해야 합니다.',
    )
  }

  function confirmPhysicalMeasurement(checked: boolean) {
    if (!profile) return
    setPhysicalConfirmationProfileId(checked ? profile.id : null)
    if (!profile.verification) return
    const verification = profile.verification
    const xAnalysis = analyzeCalibrationAxis(verification.xMeasurements)
    const yAnalysis = analyzeCalibrationAxis(verification.yMeasurements)
    const verified =
      checked &&
      xAnalysis.status === 'ready' &&
      yAnalysis.status === 'ready' &&
      xAnalysis.correctionScale !== null &&
      yAnalysis.correctionScale !== null &&
      Math.abs(xAnalysis.correctionScale - 1) <= 0.01 &&
      Math.abs(yAnalysis.correctionScale - 1) <= 0.01
    const next = {
      ...profile,
      updatedAt: new Date().toISOString(),
      verification: {
        ...verification,
        physicallyMeasured: checked,
        status: verified ? ('verified' as const) : ('needs-review' as const),
      },
    }
    if (savePrinterProfile(next)) refresh(profile.id)
  }

  function saveProfileField(
    field:
      | 'name'
      | 'manufacturer'
      | 'model'
      | 'driverInfo'
      | 'paperSize'
      | 'orientation',
    value: string,
  ) {
    if (!profile) return
    const updated = {
      ...profile,
      [field]:
        field === 'paperSize'
          ? (value as PaperSize)
          : field === 'orientation'
            ? (value as PageOrientation)
            : value.trim(),
      updatedAt: new Date().toISOString(),
    }
    if (!savePrinterProfile(updated)) {
      setError(
        '프로필 정보를 저장하지 못했습니다. 이름이 비어 있지 않은지 확인하세요.',
      )
      return
    }
    setProfileDrafts((current) => {
      const next = { ...current }
      delete next[`${profile.id}-${field}`]
      return next
    })
    setError('')
    refresh(profile.id)
  }

  function downloadProfiles() {
    const blob = new Blob([exportPrinterProfiles()], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'paper-studio-printer-profiles.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('프린터 프로필 JSON을 내보냈습니다.')
  }

  async function loadProfiles(file: File | undefined) {
    if (!file) return
    const imported = importPrinterProfiles(await file.text())
    if (!imported) {
      setError('유효한 Paper Studio 프린터 프로필 JSON 파일이 아닙니다.')
      return
    }
    setError('')
    setMessage('프린터 프로필을 가져왔습니다.')
    refresh()
  }

  return (
    <section
      className="printer-calibration-panel"
      aria-label="프린터 교정 프로필"
    >
      <div className="printer-calibration-panel__heading">
        <div>
          <strong>프린터 교정 프로필</strong>
          <span>프린터와 용지 조합별로 실측값을 이 브라우저에 저장합니다.</span>
        </div>
        <div className="printer-calibration-panel__file-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={downloadProfiles}
          >
            JSON 내보내기
          </button>
          <label className="secondary-button">
            JSON 가져오기
            <input
              aria-label="프린터 프로필 JSON 가져오기"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void loadProfiles(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="printer-profile-create">
        <label>
          프로필 이름
          <input
            aria-label="새 프로필 이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 사무실 프린터 A4"
          />
        </label>
        <label>
          제조사
          <input
            aria-label="프린터 제조사"
            value={manufacturer}
            onChange={(event) => setManufacturer(event.target.value)}
            placeholder="직접 입력"
          />
        </label>
        <label>
          모델
          <input
            aria-label="프린터 모델"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="직접 입력"
          />
        </label>
        <label>
          드라이버 또는 출력 경로
          <input
            aria-label="드라이버 또는 출력 경로"
            value={driverInfo}
            onChange={(event) => setDriverInfo(event.target.value)}
            placeholder="예: macOS AirPrint"
          />
        </label>
        <div className="printer-profile-create__paper">
          {paperSize} · {orientation === 'portrait' ? '세로' : '가로'}
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={createProfile}
        >
          프로필 만들기
        </button>
      </div>

      <div className="printer-profile-select-row">
        <label>
          현재 용지 프로필
          <select
            aria-label="현재 용지 프로필"
            value={profile?.id ?? ''}
            onChange={(event) => {
              setSelectedProfileId(event.target.value)
              setIncludedCorrectionProfileId(null)
              setPhysicalConfirmationProfileId(null)
              setError('')
            }}
          >
            <option value="">프로필 선택 안 함</option>
            {profiles
              .filter(
                (item) =>
                  item.paperSize === paperSize &&
                  item.orientation === orientation,
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {profileSummary(item)}
                  {item.isDefault ? ' · 기본' : ''}
                </option>
              ))}
          </select>
        </label>
        {profile && (
          <div className="printer-profile-select-row__actions">
            <span>
              {profile.paperSize}{' '}
              {profile.orientation === 'portrait' ? '세로' : '가로'}
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDefaultPrinterProfile(profile.id)
                refresh(profile.id)
              }}
            >
              기본 프로필 지정
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                deletePrinterProfile(profile.id)
                setIncludedCorrectionProfileId(null)
                refresh('')
              }}
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {profile ? (
        <div className="printer-profile-measurements">
          <fieldset className="printer-profile-edit">
            <legend>프로필 정보 수정</legend>
            {(
              [
                ['name', '프로필 이름'],
                ['manufacturer', '제조사'],
                ['model', '모델'],
                ['driverInfo', '드라이버 또는 출력 경로'],
                ['paperSize', '용지 크기'],
                ['orientation', '방향'],
              ] as const
            ).map(([field, label]) => {
              const key = `${profile.id}-${field}`
              return (
                <label key={field}>
                  {label}
                  {field === 'paperSize' || field === 'orientation' ? (
                    <select
                      aria-label={label}
                      value={profileDrafts[key] ?? profile[field]}
                      onChange={(event) => {
                        setProfileDrafts((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                        saveProfileField(field, event.target.value)
                      }}
                    >
                      {field === 'paperSize' ? (
                        <>
                          <option value="A4">A4</option>
                          <option value="A3">A3</option>
                        </>
                      ) : (
                        <>
                          <option value="portrait">세로</option>
                          <option value="landscape">가로</option>
                        </>
                      )}
                    </select>
                  ) : (
                    <input
                      aria-label={label}
                      value={profileDrafts[key] ?? profile[field]}
                      onChange={(event) =>
                        setProfileDrafts((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        saveProfileField(field, event.target.value)
                      }
                    />
                  )}
                </label>
              )
            })}
          </fieldset>
          <div className="printer-profile-measurements__intro">
            <strong>1 · 교정 페이지를 실제 크기로 출력하고 측정</strong>
            <span>
              X축은 가로 기준선, Y축은 세로 기준선과 사각형을 자로 재세요.
              프린터 모델과 드라이버는 자동으로 읽지 않습니다.
            </span>
            <span>
              기준 실측일 ·{' '}
              {profile.measuredAt
                ? new Date(profile.measuredAt).toLocaleDateString()
                : '아직 측정하지 않음'}
            </span>
          </div>
          {(['x', 'y'] as const).map((axis) => (
            <fieldset key={axis} className="printer-profile-axis-measurements">
              <legend>{axis.toUpperCase()}축 실측값 (mm)</legend>
              {TARGETS.map((targetMm) => {
                const stored = profile[`${axis}Measurements`].find(
                  (measurement) => measurement.targetMm === targetMm,
                )
                const draftKey = `${profile.id}-${axis}-${targetMm}`
                return (
                  <label key={targetMm}>
                    {targetMm} mm 기준선
                    <input
                      type="number"
                      min="0.1"
                      max={targetMm * 2}
                      step="0.1"
                      aria-label={`${axis.toUpperCase()}축 ${targetMm} mm 실측값`}
                      value={
                        measurementDrafts[draftKey] ?? stored?.measuredMm ?? ''
                      }
                      placeholder="실제 출력 후 측정"
                      onChange={(event) =>
                        setMeasurementDrafts((current) => ({
                          ...current,
                          [draftKey]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        saveMeasurement(axis, targetMm, event.target.value)
                      }
                    />
                  </label>
                )
              })}
            </fieldset>
          ))}
          <section
            className="printer-profile-analysis"
            aria-label="배율 오차 분석"
          >
            <strong>실측 분석 · 목표 길이 ÷ 실제 측정 길이</strong>
            {(
              [
                ['X', xAnalysis],
                ['Y', yAnalysis],
              ] as const
            ).map(([axis, analysis]) => (
              <p key={axis} data-analysis-status={analysis?.status}>
                {axis}축 · {analysis?.message}
                {analysis?.correctionScale !== null &&
                analysis?.correctionScale !== undefined
                  ? ` · 권장 ${(analysis.correctionScale * 100).toFixed(2)}% · 측정 간 편차 ${analysis.scaleSpreadPercent?.toFixed(2)}%`
                  : ''}
                {analysis?.outlierTargetsMm.length
                  ? ` · 이상치 ${analysis.outlierTargetsMm.join(', ')} mm 제외 검토`
                  : ''}
              </p>
            ))}
            {profile.correction && (
              <p>
                두 축 모두 일관된 실측값이 있어 보정 추천값을 저장했습니다. 단일
                결과로 다른 용지·드라이버·환경의 오차까지 해결된다는 뜻은
                아닙니다.
              </p>
            )}
          </section>
          {profile.correction && onCorrectionChange ? (
            <label className="printer-profile-correction-toggle">
              <input
                type="checkbox"
                aria-label="이 프로필의 보정 배율 PDF에 적용"
                checked={includedCorrectionProfileId === profile.id}
                onChange={(event) =>
                  setIncludedCorrectionProfileId(
                    event.target.checked ? profile.id : null,
                  )
                }
              />
              <span>
                2 · {profile.name} 보정 적용 · X{' '}
                {(profile.correction.xScale * 100).toFixed(2)}% / Y{' '}
                {(profile.correction.yScale * 100).toFixed(2)}%
              </span>
            </label>
          ) : (
            <p className="export-dialog__note">
              아직 보정 배율이 없습니다. 실제 측정값만으로 프린터의 모든 오차가
              해결된다고 볼 수 없으며, 서로 다른 길이 측정값의 일관성을 확인한
              뒤 배율을 권장합니다.
            </p>
          )}
          {profile.correction && (
            <>
              <div className="printer-profile-measurements__intro">
                <strong>3 · 보정 PDF를 다시 출력하고 검증 실측값 입력</strong>
                <span>
                  X/Y 각 축에서 서로 다른 길이 두 개 이상을 재세요. 입력값은
                  보정 전 측정값과 분리해 저장합니다.
                </span>
              </div>
              {(['x', 'y'] as const).map((axis) => (
                <fieldset
                  key={`verification-${axis}`}
                  className="printer-profile-axis-measurements"
                >
                  <legend>{axis.toUpperCase()}축 보정 후 실측값 (mm)</legend>
                  {TARGETS.map((targetMm) => {
                    const stored = profile.verification?.[
                      `${axis}Measurements`
                    ].find((measurement) => measurement.targetMm === targetMm)
                    const draftKey = `${profile.id}-${axis}-${targetMm}`
                    return (
                      <label key={targetMm}>
                        {targetMm} mm 재출력
                        <input
                          type="number"
                          min="0.1"
                          max={targetMm * 2}
                          step="0.1"
                          aria-label={`${axis.toUpperCase()}축 보정 후 ${targetMm} mm 실측값`}
                          value={
                            verificationDrafts[draftKey] ??
                            stored?.measuredMm ??
                            ''
                          }
                          placeholder="재출력 후 측정"
                          onChange={(event) =>
                            setVerificationDrafts((current) => ({
                              ...current,
                              [draftKey]: event.target.value,
                            }))
                          }
                          onBlur={(event) =>
                            saveVerificationMeasurement(
                              axis,
                              targetMm,
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    )
                  })}
                </fieldset>
              ))}
              <label className="printer-profile-physical-confirmation">
                <input
                  type="checkbox"
                  aria-label="실제 재출력물을 자로 측정했습니다"
                  checked={
                    physicalConfirmationProfileId === profile.id ||
                    profile.verification?.physicallyMeasured === true
                  }
                  onChange={(event) =>
                    confirmPhysicalMeasurement(event.target.checked)
                  }
                />
                보정 PDF를 실제로 출력하고 자로 측정했습니다.
              </label>
              {profile.verification ? (
                <div
                  className="printer-profile-verification"
                  data-verification-status={profile.verification.status}
                  role="status"
                >
                  {profile.verification.status === 'verified'
                    ? '두 축에서 2개 이상 실제 측정값이 1% 이내로 확인됐습니다.'
                    : '실측값을 기록했습니다. 두 축의 일관성과 1% 허용 오차를 더 확인해야 합니다.'}
                  <span>
                    마지막 재출력 실측 ·{' '}
                    {new Date(
                      profile.verification.measuredAt,
                    ).toLocaleDateString()}
                  </span>
                  {(['x', 'y'] as const).map((axis) => {
                    const baseline = profile[`${axis}Measurements`].find(
                      (measurement) => measurement.targetMm === 100,
                    )
                    const after = profile.verification?.[
                      `${axis}Measurements`
                    ].find((measurement) => measurement.targetMm === 100)
                    if (!baseline || !after) return null
                    const beforeError = compareCalibrationMeasurement(
                      100,
                      baseline.measuredMm,
                    ).errorPercent
                    const afterError = compareCalibrationMeasurement(
                      100,
                      after.measuredMm,
                    ).errorPercent
                    return (
                      <span key={axis}>
                        {axis.toUpperCase()} 100 mm 오차 · 전{' '}
                        {beforeError >= 0 ? '+' : ''}
                        {beforeError.toFixed(2)}% → 후{' '}
                        {afterError >= 0 ? '+' : ''}
                        {afterError.toFixed(2)}%
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="export-dialog__note">
                  보정 후 재출력 측정은 아직 기록되지 않았습니다. 실제로 측정한
                  값만 입력하세요.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="export-dialog__note">
          {paperSize} {orientation === 'portrait' ? '세로' : '가로'} 용지의
          프로필을 선택하거나 새로 만드세요.
        </p>
      )}

      {error && (
        <p className="dimension-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="printer-profile-status" role="status">
          {message}
        </p>
      )}
      <p className="export-dialog__note">
        교정값은 현재 브라우저에만 저장됩니다. PDF는 실물 프린터의 출력 정확도를
        보장하지 않습니다. 비균일한 X/Y 보정은 면·접착탭·텍스처의 비율과 조립
        결과에 영향을 줄 수 있습니다.
      </p>
    </section>
  )
}
