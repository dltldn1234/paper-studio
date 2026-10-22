import { useMemo, useState } from 'react'
import type { MeasurementHistoryEntry } from './measurement-history'
import type { PrinterProfile } from './printer-profiles'
import {
  analyzeAccuracy,
  buildAccuracySamples,
  filterAccuracySamples,
  MIN_STATISTICAL_SAMPLES,
} from './statistics'
import {
  createVerificationReport,
  serializeVerificationReport,
} from './verification-report'

type Props = {
  history: MeasurementHistoryEntry[]
  profiles: PrinterProfile[]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function VerificationDashboard({ history, profiles }: Props) {
  const [profileId, setProfileId] = useState('all')
  const [paperSize, setPaperSize] = useState<'all' | 'A4' | 'A3'>('all')
  const [driverInfo, setDriverInfo] = useState('all')
  const [phase, setPhase] = useState<'all' | MeasurementHistoryEntry['phase']>(
    'all',
  )
  const [axis, setAxis] = useState<'all' | 'x' | 'y'>('all')
  const [orientation, setOrientation] = useState<
    'all' | 'portrait' | 'landscape' | 'unknown'
  >('all')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const samples = useMemo(
    () => buildAccuracySamples(history, profiles),
    [history, profiles],
  )
  const visible = useMemo(
    () =>
      filterAccuracySamples(samples, {
        profileId: profileId === 'all' ? undefined : profileId,
        paperSize,
        driverInfo,
        phase,
        axis,
        orientation,
      }),
    [axis, driverInfo, orientation, paperSize, phase, profileId, samples],
  )
  const summary = analyzeAccuracy(visible)
  const xStats = analyzeAccuracy(
    visible.filter(({ axis: value }) => value === 'x'),
  )
  const yStats = analyzeAccuracy(
    visible.filter(({ axis: value }) => value === 'y'),
  )
  const outlierIds = new Set(summary?.outlierIds ?? [])
  const selectedProfile = profiles.find(({ id }) => id === profileId)
  const selectedReport = selectedProfile
    ? createVerificationReport(selectedProfile, history)
    : null

  function downloadReport(kind: 'json' | 'pdf') {
    if (!selectedProfile) {
      setError('보고서를 만들 프린터 프로필을 선택하세요.')
      return
    }
    setError('')
    const report = createVerificationReport(selectedProfile, history)
    if (kind === 'json') {
      downloadBlob(
        new Blob([serializeVerificationReport(report)], {
          type: 'application/json',
        }),
        `paper-studio-verification-${selectedProfile.id}.json`,
      )
      setStatus('JSON 검증 보고서를 다운로드했습니다.')
      return
    }
    void import('../export/verification-report-pdf')
      .then(({ createVerificationReportPdf }) =>
        createVerificationReportPdf(report),
      )
      .then((bytes) => {
        const buffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(buffer).set(bytes)
        downloadBlob(
          new Blob([buffer], { type: 'application/pdf' }),
          `paper-studio-verification-${selectedProfile.id}.pdf`,
        )
        setStatus('PDF 검증 보고서를 다운로드했습니다.')
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : 'PDF 검증 보고서를 만들지 못했습니다.',
        ),
      )
  }

  return (
    <section className="verification-dashboard" aria-label="검증 대시보드">
      <div className="verification-dashboard__heading">
        <div>
          <h3>검증 대시보드</h3>
          <p>
            기존 프로필과 측정 이력을 연결합니다. 과거 기록에 저장되지 않은 출력
            조건은 미기록으로 표시합니다.
          </p>
        </div>
        <div className="verification-dashboard__exports">
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedProfile}
            onClick={() => downloadReport('json')}
          >
            JSON 보고서
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedProfile}
            onClick={() => downloadReport('pdf')}
          >
            PDF 보고서
          </button>
        </div>
      </div>
      <div
        className="verification-dashboard__filters"
        aria-label="검증 환경 필터"
      >
        <label>
          프린터 프로필
          <select
            aria-label="검증 프린터 프로필"
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
          >
            <option value="all">모든 프로필</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.paperSize}
              </option>
            ))}
          </select>
        </label>
        <label>
          용지
          <select
            aria-label="검증 용지 필터"
            value={paperSize}
            onChange={(event) =>
              setPaperSize(event.target.value as typeof paperSize)
            }
          >
            <option value="all">전체</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </label>
        <label>
          드라이버
          <select
            aria-label="검증 드라이버 필터"
            value={driverInfo}
            onChange={(event) => setDriverInfo(event.target.value)}
          >
            <option value="all">전체</option>
            {[...new Set(samples.map(({ driverInfo: value }) => value))].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          측정 시점
          <select
            aria-label="검증 측정 시점 필터"
            value={phase}
            onChange={(event) => setPhase(event.target.value as typeof phase)}
          >
            <option value="all">전체</option>
            <option value="calibration">보정 전</option>
            <option value="verification">보정 후</option>
            <option value="legacy">이전 기록</option>
          </select>
        </label>
        <label>
          축
          <select
            aria-label="검증 축 필터"
            value={axis}
            onChange={(event) => setAxis(event.target.value as typeof axis)}
          >
            <option value="all">X/Y 전체</option>
            <option value="x">X축</option>
            <option value="y">Y축</option>
          </select>
        </label>
        <label>
          방향
          <select
            aria-label="검증 방향 필터"
            value={orientation}
            onChange={(event) =>
              setOrientation(event.target.value as typeof orientation)
            }
          >
            <option value="all">전체</option>
            <option value="portrait">세로</option>
            <option value="landscape">가로</option>
            <option value="unknown">기록 당시 미기록</option>
          </select>
        </label>
      </div>

      <div
        className="verification-dashboard__profiles"
        aria-label="프로필 검증 상태"
      >
        {profiles.map((profile) => (
          <article key={profile.id}>
            <strong>{profile.name}</strong>
            <span>
              {profile.paperSize} · {profile.orientation}
            </span>
            <span
              className={
                profile.verification?.status === 'verified'
                  ? 'verification-dashboard__badge is-verified'
                  : 'verification-dashboard__badge'
              }
              data-verification-status={
                profile.verification?.status ?? 'unverified'
              }
            >
              {profile.verification?.status === 'verified'
                ? '실측 확인됨'
                : profile.verification
                  ? '재검토 필요'
                  : '미검증'}
            </span>
          </article>
        ))}
        {profiles.length === 0 && <p>등록된 프린터 프로필이 없습니다.</p>}
      </div>

      <div
        className="verification-dashboard__summary"
        aria-label="필터된 측정 요약"
      >
        <article>
          <span>측정 횟수</span>
          <strong>{summary?.sampleCount ?? 0}</strong>
        </article>
        <article>
          <span>평균 오차</span>
          <strong>
            {summary
              ? `${summary.meanErrorMm >= 0 ? '+' : ''}${summary.meanErrorMm.toFixed(2)} mm`
              : '기록 없음'}
          </strong>
        </article>
        <article>
          <span>X축 평균 절대 오차</span>
          <strong>
            {xStats
              ? `${xStats.meanAbsoluteErrorMm.toFixed(2)} mm`
              : '기록 없음'}
          </strong>
        </article>
        <article>
          <span>Y축 평균 절대 오차</span>
          <strong>
            {yStats
              ? `${yStats.meanAbsoluteErrorMm.toFixed(2)} mm`
              : '기록 없음'}
          </strong>
        </article>
      </div>
      {summary && summary.sampleCount < MIN_STATISTICAL_SAMPLES && (
        <p className="accuracy-analysis__warning" role="status">
          표본 수가 적어 통계 결과는 참고용입니다. 반복 측정을 권장합니다.
        </p>
      )}
      {outlierIds.size > 0 && (
        <p className="accuracy-analysis__warning" role="status">
          이상치 {outlierIds.size}건이 포함되어 있습니다. 원본 기록은
          보존됩니다.
        </p>
      )}
      {selectedProfile?.verification && (
        <p className="verification-dashboard__condition-note" role="status">
          {selectedProfile.verification.status === 'needs-review'
            ? '출력 조건이 바뀌었거나 허용 오차를 충족하지 못했습니다. 보정 시트를 다시 출력하고 재검증하세요.'
            : '검증 결과는 현재 프로필의 프린터·용지·방향 조건에 한정됩니다. 조건 변경 후 다시 확인하세요.'}
        </p>
      )}
      {selectedReport && (
        <div
          className="verification-dashboard__comparison"
          aria-label="프로필 보정 전후 비교"
        >
          <h4>프로필 보정 전후 오차 비교</h4>
          {(['x', 'y'] as const).map((axis) => {
            const before = selectedReport.profileComparison.before[axis]
            const after = selectedReport.profileComparison.after[axis]
            return (
              <span key={axis}>
                {axis.toUpperCase()}축 · 전{' '}
                {before
                  ? `${before.meanAbsoluteErrorMm.toFixed(2)} mm`
                  : '기록 없음'}
                {' → '}후{' '}
                {after
                  ? `${after.meanAbsoluteErrorMm.toFixed(2)} mm`
                  : '기록 없음'}
              </span>
            )
          })}
          <span>
            전체 변화 ·{' '}
            {selectedReport.profileComparison.improvementMm === null
              ? '비교할 실측값 부족'
              : `${selectedReport.profileComparison.improvementMm >= 0 ? '+' : ''}${selectedReport.profileComparison.improvementMm.toFixed(2)} mm 개선`}
          </span>
        </div>
      )}
      <div className="verification-dashboard__workflow">
        <h4>재검증 순서</h4>
        <ol>
          <li>위의 프린터 프로필을 선택하고 출력 설정을 확인합니다.</li>
          <li>이 대화상자에서 PDF 교정 시트를 100% 실제 크기로 출력합니다.</li>
          <li>
            출력물을 직접 측정해 기존 프로필의 보정 후 실측값과 이력에
            입력합니다.
          </li>
          <li>
            실측 확인을 직접 표시한 뒤 보정 전후 통계와 경고를 확인합니다.
          </li>
        </ol>
      </div>

      <div
        className="verification-dashboard__records"
        aria-label="상세 측정 기록"
      >
        <h4>상세 측정 기록 · {visible.length}건</h4>
        {visible.length === 0 ? (
          <p>선택한 환경의 측정 이력이 없습니다.</p>
        ) : (
          <div className="verification-dashboard__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>프로필</th>
                  <th>설정</th>
                  <th>구분</th>
                  <th>축</th>
                  <th>기준</th>
                  <th>실측</th>
                  <th>오차</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    data-outlier={outlierIds.has(item.id) || undefined}
                  >
                    <td>{new Date(item.measuredAt).toLocaleString()}</td>
                    <td>{item.printerLabel}</td>
                    <td>
                      {item.paperSize} ·{' '}
                      {item.orientation === 'unknown'
                        ? '방향 미기록'
                        : item.orientation === 'portrait'
                          ? '세로'
                          : '가로'}{' '}
                      · {item.driverInfo}
                    </td>
                    <td>
                      {item.phase === 'calibration'
                        ? '보정 전'
                        : item.phase === 'verification'
                          ? '보정 후'
                          : '이전'}
                    </td>
                    <td>{item.axis.toUpperCase()}</td>
                    <td>{item.targetMm} mm</td>
                    <td>{item.measuredMm.toFixed(2)} mm</td>
                    <td>
                      {item.errorMm >= 0 ? '+' : ''}
                      {item.errorMm.toFixed(2)} mm
                      {outlierIds.has(item.id) ? ' · 이상치' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {error && (
        <p className="dimension-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="printer-profile-status" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
