import { useEffect, useMemo, useRef } from 'react'
import type { RankingHistoryLine, RankingHistoryStep } from '../lib/rankingHistory'

interface RankingEvolutionChartProps {
  steps: RankingHistoryStep[]
  lines: RankingHistoryLine[]
}

const H = 340
const PAD = { top: 24, right: 52, bottom: 52, left: 40 }
const MIN_CHART_W = 808
const STEP_WIDTH = 56

function chartWidth(steps: number): number {
  if (steps <= 1) return MIN_CHART_W
  return Math.max(MIN_CHART_W, (steps - 1) * STEP_WIDTH)
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function RankingEvolutionChart({ steps, lines }: RankingEvolutionChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const maxPos = lines.length || 1
  const chartW = chartWidth(steps.length)
  const W = PAD.left + chartW + PAD.right
  const chartH = H - PAD.top - PAD.bottom

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }, [steps.length])

  const xScale = useMemo(() => {
    const n = steps.length
    return (i: number) => {
      if (n <= 1) return PAD.left + chartW / 2
      return PAD.left + (i / (n - 1)) * chartW
    }
  }, [steps.length, chartW])

  const yScale = useMemo(() => {
    return (pos: number) => {
      if (maxPos <= 1) return PAD.top + chartH / 2
      return PAD.top + ((pos - 1) / (maxPos - 1)) * chartH
    }
  }, [maxPos, chartH])

  if (steps.length === 0) {
    return (
      <div className="card ranking-chart empty">
        <p className="sub">O gráfico aparece quando houver jogos com placar.</p>
      </div>
    )
  }

  const yTicks = Array.from({ length: maxPos }, (_, i) => i + 1)

  return (
    <div className="card ranking-chart">
      <h3 className="ranking-chart-title">Evolução do ranking</h3>
      <p className="sub ranking-chart-sub">Posição após cada jogo com placar</p>
      <div className="ranking-chart-scroll" ref={scrollRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="ranking-chart-svg"
          role="img"
          aria-label="Gráfico de evolução das posições no ranking"
        >
          {yTicks.map((pos) => (
            <g key={pos}>
              <line
                x1={PAD.left}
                y1={yScale(pos)}
                x2={W - PAD.right}
                y2={yScale(pos)}
                className="ranking-chart-grid"
              />
              <text x={PAD.left - 8} y={yScale(pos) + 4} className="ranking-chart-ytick" textAnchor="end">
                {pos}º
              </text>
            </g>
          ))}

          {steps.map((step, i) => (
            <text
              key={step.partida.id}
              x={xScale(i)}
              y={H - 14}
              className="ranking-chart-xtick"
              textAnchor="middle"
            >
              <title>
                {step.partida.time_casa} × {step.partida.time_fora}
              </title>
              {step.label}
            </text>
          ))}

          {lines.map((line) => {
            const pts = line.positions
              .map((pos, i) => `${xScale(i)},${yScale(pos)}`)
              .join(' ')
            return (
              <polyline
                key={`line-${line.participanteId}`}
                points={pts}
                fill="none"
                stroke={line.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                opacity={0.9}
              />
            )
          })}

          {lines.map((line) => {
            const lastI = line.positions.length - 1
            const lastPos = line.positions[lastI]
            const cx = xScale(lastI)
            const cy = yScale(lastPos)
            const r = 14

            return (
              <g key={`avatar-${line.participanteId}`} className="ranking-chart-line">
                <circle cx={cx} cy={cy} r={r + 2} className="ranking-chart-avatar-ring" stroke={line.color} />
                {line.photoURL ? (
                  <>
                    <defs>
                      <clipPath id={`clip-${line.participanteId}`}>
                        <circle cx={cx} cy={cy} r={r} />
                      </clipPath>
                    </defs>
                    <image
                      href={line.photoURL}
                      x={cx - r}
                      y={cy - r}
                      width={r * 2}
                      height={r * 2}
                      clipPath={`url(#clip-${line.participanteId})`}
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
                <title>
                  {line.nome}: {lastPos}º após {steps[lastI]?.label}
                </title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
