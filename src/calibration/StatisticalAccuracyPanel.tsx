import { useMemo, useState } from 'react'
import type { MeasurementHistoryEntry } from './measurement-history'
import type { PrinterProfile } from './printer-profiles'
import {
  analyzeAccuracy,
  buildAccuracySamples,
  compareCalibrationPhases,
  filterAccuracySamples,
  MIN_STATISTICAL_SAMPLES,
} from './statistics'

type Props = {
  history: MeasurementHistoryEntry[]
  profiles: PrinterProfile[]
}

function formatMm(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} mm`
}

export function StatisticalAccuracyPanel({ history, profiles }: Props) {
  const [profileId, setProfileId] = useState('all')
  const [paperSize, setPaperSize] = useState<'all' | 'A4' | 'A3'>('all')
  const [driverInfo, setDriverInfo] = useState('all')
  const [phase, setPhase] = useState<'all' | MeasurementHistoryEntry['phase']>(
    'all',
  )
  const [axis, setAxis] = useState<'all' | 'x' | 'y'>('all')
  const samples = useMemo(
    () => buildAccuracySamples(history, profiles),
    [history, profiles],
  )
  const filtered = useMemo(
    () =>
      filterAccuracySamples(samples, {
        profileId: profileId === 'all' ? undefined : profileId,
        paperSize,
        driverInfo,
        phase,
        axis,
      }),
    [axis, driverInfo, paperSize, phase, profileId, samples],
  )
  const summary = analyzeAccuracy(filtered)
  const xStats = analyzeAccuracy(
    filtered.filter(({ axis: itemAxis }) => itemAxis === 'x'),
  )
  const yStats = analyzeAccuracy(
    filtered.filter(({ axis: itemAxis }) => itemAxis === 'y'),
  )
  const axisErrorScale = Math.max(
    xStats?.meanAbsoluteErrorMm ?? 0,
    yStats?.meanAbsoluteErrorMm ?? 0,
    0.1,
  )
  const phaseComparison = compareCalibrationPhases(
    filterAccuracySamples(samples, {
      profileId: profileId === 'all' ? undefined : profileId,
      paperSize,
      driverInfo,
      axis: axis === 'all' ? undefined : axis,
    }),
  )
  const ordered = [...filtered].sort(
    (a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt),
  )
  const maxMagnitude = Math.max(
    1,
    ...ordered.map(({ errorMm }) => Math.abs(errorMm)),
  )

  return (
    <section className="accuracy-analysis" aria-label="측정 정확도 분석">
      <div className="accuracy-analysis__heading">
        <div>
          <h3>측정 정확도 분석</h3>
          <p>
            저장된 측정 이력을 조건별로 요약합니다. 기록은 자동 삭제되지
            않습니다.
          </p>
        </div>
        <div className="accuracy-analysis__filters" aria-label="통계 환경 필터">
          <label>
            프린터 프로필
            <select
              aria-label="통계 프린터 프로필"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              <option value="all">모든 프린터</option>
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
              aria-label="통계 용지 크기"
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
              aria-label="통계 드라이버"
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
            측정 구분
            <select
              aria-label="통계 측정 구분"
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
              aria-label="통계 측정 축"
              value={axis}
              onChange={(event) => setAxis(event.target.value as typeof axis)}
            >
              <option value="all">X/Y 전체</option>
              <option value="x">X축</option>
              <option value="y">Y축</option>
            </select>
          </label>
        </div>
      </div>

      {!summary ? (
        <p className="accuracy-analysis__empty">
          분석할 유효한 측정 기록이 없습니다.
        </p>
      ) : (
        <>
          {summary.sampleCount < MIN_STATISTICAL_SAMPLES && (
            <p className="accuracy-analysis__warning" role="status">
              표본 수가 {MIN_STATISTICAL_SAMPLES}개보다 적습니다. 통계 결과는
              참고용이며 반복 측정을 권장합니다.
            </p>
          )}
          {summary.outlierIds.length > 0 && (
            <p className="accuracy-analysis__warning" role="status">
              이상치 {summary.outlierIds.length}건을 찾았습니다. 원본 이력은
              보존되며 자동 삭제되지 않습니다.
            </p>
          )}
          <div className="accuracy-analysis__cards" aria-label="통계 요약">
            <article>
              <span>측정 횟수</span>
              <strong>{summary.sampleCount}</strong>
            </article>
            <article>
              <span>평균 오차</span>
              <strong>{formatMm(summary.meanErrorMm)}</strong>
            </article>
            <article>
              <span>평균 오차율</span>
              <strong>{summary.meanErrorRatePercent.toFixed(2)}%</strong>
            </article>
            <article>
              <span>표준편차 · 변동성</span>
              <strong>{summary.standardDeviationMm.toFixed(2)} mm</strong>
            </article>
            <article>
              <span>최소 / 최대 오차</span>
              <strong>
                {formatMm(summary.minimumErrorMm)} /{' '}
                {formatMm(summary.maximumErrorMm)}
              </strong>
            </article>
            <article>
              <span>시간 오차 추세</span>
              <strong>
                {summary.trend === 'improving'
                  ? '개선'
                  : summary.trend === 'worsening'
                    ? '악화'
                    : summary.trend === 'stable'
                      ? '안정'
                      : '표본 부족'}
              </strong>
            </article>
          </div>
          <div className="accuracy-analysis__comparisons">
            <div>
              <h4>X/Y축 평균 절대 오차</h4>
              <label className="accuracy-analysis__axis-row">
                <span>
                  X축 ·{' '}
                  {xStats ? formatMm(xStats.meanAbsoluteErrorMm) : '기록 없음'}
                </span>
                <progress
                  aria-label="X축 평균 절대 오차"
                  max={axisErrorScale}
                  value={xStats?.meanAbsoluteErrorMm ?? 0}
                />
              </label>
              <label className="accuracy-analysis__axis-row">
                <span>
                  Y축 ·{' '}
                  {yStats ? formatMm(yStats.meanAbsoluteErrorMm) : '기록 없음'}
                </span>
                <progress
                  aria-label="Y축 평균 절대 오차"
                  max={axisErrorScale}
                  value={yStats?.meanAbsoluteErrorMm ?? 0}
                />
              </label>
            </div>
            <div>
              <h4>보정 전후 변화</h4>
              <p>
                {phaseComparison
                  ? `평균 절대 오차 ${formatMm(phaseComparison.improvementMm)} 개선`
                  : '보정 전·후 데이터가 모두 있어야 비교할 수 있습니다.'}
              </p>
            </div>
          </div>
          <div
            className="accuracy-analysis__chart"
            role="img"
            aria-label="시간에 따른 측정 오차 추세"
          >
            <h4>시간에 따른 오차 · 반복 측정 변동</h4>
            <div className="accuracy-analysis__plot">
              <span className="accuracy-analysis__zero" />
              {ordered.map((sample, index) => (
                <span
                  key={sample.id}
                  className={`accuracy-analysis__point${summary.outlierIds.includes(sample.id) ? 'is-outlier' : ''}`}
                  style={{
                    left: `${ordered.length === 1 ? 50 : (index / (ordered.length - 1)) * 100}%`,
                    top: `${50 - (sample.errorMm / maxMagnitude) * 42}%`,
                  }}
                  title={`${new Date(sample.measuredAt).toLocaleDateString()} · ${sample.axis.toUpperCase()} · ${formatMm(sample.errorMm)}${summary.outlierIds.includes(sample.id) ? ' · 이상치' : ''}`}
                />
              ))}
            </div>
            <div className="accuracy-analysis__plot-caption">
              <span>− 오차</span>
              <span>0 mm</span>
              <span>+ 오차</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
