import { useEffect, useMemo, useRef } from 'react'
import { ChartRaceHeader } from './ChartRaceHeader'
import {
  axisTicks,
  chartWidth,
  EVOLUTION_CHART,
  initials,
  lineHeadSeries,
  niceAxisMax,
  partialPolylineSeries,
  useChartRacePlayhead,
} from '../lib/chartRace'
import type { PointsHistoryLine, RankingHistoryStep } from '../lib/rankingHistory'
import { teamFlagUrl } from '../lib/teamFlags'

interface PointsEvolutionChartProps {
  steps: RankingHistoryStep[]
  lines: PointsHistoryLine[]
}

const { H, PAD, FLAG_W, FLAG_H, FLAG_GAP, AVATAR_R } = EVOLUTION_CHART

function SeriesAvatar({
  line,
  cx,
  cy,
}: {
  line: PointsHistoryLine
  cx: number
  cy: number
}) {
  const r = AVATAR_R
  const clipId = `pts-clip-${line.participanteId}`

  return (
    <g className="ranking-chart-line">
      <circle cx={cx} cy={cy} r={r + 2} className="ranking-chart-avatar-ring" stroke={line.color} />
      {line.photoURL ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
          </defs>
          <image
            href={line.photoURL}
            x={cx - r}
            y={cy - r}
            width={r * 2}
            height={r * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r} fill={line.color} opacity={0.85} />
          <text x={cx} y={cy + 4} className="ranking-chart-avatar-initials" textAnchor="middle">
            {initials(line.nome)}
          </text>
        </>
      )}
    </g>
  )
}

export function PointsEvolutionChart({ steps, lines }: PointsEvolutionChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stepsKey = useMemo(() => steps.map((s) => s.partida.id).join(','), [steps])
  const { playhead, animDone, replay, canReplay } = useChartRacePlayhead(stepsKey, steps.length)

  const chartW = chartWidth(steps.length)
  const W = PAD.left + chartW + PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxPts = useMemo(() => {
    const peak = lines.reduce((m, line) => Math.max(m, ...line.points), 0)
    return niceAxisMax(peak)
  }, [lines])

  const yTicks = useMemo(() => axisTicks(maxPts), [maxPts])

  const xScale = useMemo(() => {
    const n = steps.length
    return (i: number) => {
      if (n <= 1) return PAD.left + chartW / 2
      return PAD.left + (i / (n - 1)) * chartW
    }
  }, [steps.length, chartW])

  const xAtPlayhead = useMemo(() => {
    const n = steps.length
    return (p: number) => {
      if (n <= 1) return PAD.left + chartW / 2
      return PAD.left + (p / (n - 1)) * chartW
    }
  }, [steps.length, chartW])

  const yScale = useMemo(() => {
    return (pts: number) => {
      if (maxPts <= 0) return PAD.top + chartH / 2
      return PAD.top + chartH - (pts / maxPts) * chartH
    }
  }, [maxPts, chartH])

  const maxPlayhead = Math.max(0, steps.length - 1)
  const displayPlayhead = animDone ? maxPlayhead : playhead
  const currentStep = Math.min(Math.round(displayPlayhead), steps.length - 1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (animDone) {
      el.scrollLeft = el.scrollWidth - el.clientWidth
      return
    }

    const x = xAtPlayhead(displayPlayhead)
    const target = x - el.clientWidth * 0.38
    el.scrollLeft = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth))
  }, [displayPlayhead, animDone, xAtPlayhead])

  if (steps.length === 0) {
    return null
  }

  const avatars = lines
    .map((line) => ({
      line,
      head: lineHeadSeries(line.points, displayPlayhead, xAtPlayhead, yScale),
    }))
    .sort((a, b) => a.head.y - b.head.y)

  return (
    <div className="card ranking-chart">
      <ChartRaceHeader
        title="Evolução de pontos"
        subtitle={
          animDone
            ? 'Total acumulado após cada jogo com placar'
            : `Jogo ${currentStep + 1} de ${steps.length} · ${steps[currentStep]?.label ?? ''}`
        }
        canReplay={canReplay}
        onReplay={replay}
      />
      <div className="ranking-chart-scroll" ref={scrollRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="ranking-chart-svg"
          role="img"
          aria-label="Gráfico de evolução de pontos acumulados"
        >
          {yTicks.map((pts) => (
            <g key={pts}>
              <line
                x1={PAD.left}
                y1={yScale(pts)}
                x2={W - PAD.right}
                y2={yScale(pts)}
                className="ranking-chart-grid"
              />
              <text x={PAD.left - 8} y={yScale(pts) + 4} className="ranking-chart-ytick" textAnchor="end">
                {pts}
              </text>
            </g>
          ))}

          {steps.map((step, i) => {
            const cx = xScale(i)
            const y = H - 24
            const totalW = FLAG_W * 2 + FLAG_GAP
            const x0 = cx - totalW / 2
            const reached = i <= displayPlayhead + 0.05
            return (
              <g
                key={step.partida.id}
                className="ranking-chart-match-label"
                opacity={reached ? 1 : 0.28}
              >
                <title>{step.label}</title>
                <image
                  href={teamFlagUrl(step.partida.time_casa)}
                  x={x0}
                  y={y}
                  width={FLAG_W}
                  height={FLAG_H}
                />
                <image
                  href={teamFlagUrl(step.partida.time_fora)}
                  x={x0 + FLAG_W + FLAG_GAP}
                  y={y}
                  width={FLAG_W}
                  height={FLAG_H}
                />
              </g>
            )
          })}

          {lines.map((line) => (
            <polyline
              key={`pts-line-${line.participanteId}`}
              points={partialPolylineSeries(line.points, displayPlayhead, xScale, xAtPlayhead, yScale)}
              fill="none"
              stroke={line.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              opacity={0.9}
            />
          ))}

          {!animDone && (
            <line
              x1={xAtPlayhead(displayPlayhead)}
              y1={PAD.top}
              x2={xAtPlayhead(displayPlayhead)}
              y2={H - PAD.bottom}
              className="ranking-chart-playhead"
            />
          )}

          {avatars.map(({ line, head }) => (
            <g key={`pts-avatar-${line.participanteId}`}>
              <SeriesAvatar line={line} cx={head.x} cy={head.y} />
              <title>
                {line.nome}: {Math.round(head.value)} pts
              </title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
