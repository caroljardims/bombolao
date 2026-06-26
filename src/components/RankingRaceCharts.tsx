import { useMemo, useState } from 'react'
import { RankingEvolutionChart } from './RankingEvolutionChart'
import { PointsEvolutionChart } from './PointsEvolutionChart'
import { buildRankingHistory } from '../lib/rankingHistory'
import type { Palpite, Participante, Partida } from '../lib/types'

interface RankingRaceChartsProps {
  participantes: Participante[]
  palpites: Palpite[]
  partidas: Partida[]
}

type ChartView = 'posicao' | 'pontos'

export function RankingRaceCharts({ participantes, palpites, partidas }: RankingRaceChartsProps) {
  const history = useMemo(
    () => buildRankingHistory(participantes, palpites, partidas),
    [participantes, palpites, partidas],
  )
  const [view, setView] = useState<ChartView>('posicao')

  if (history.steps.length === 0) return null

  return (
    <section className="rank-charts">
      <div className="chart-toggle" role="tablist" aria-label="Tipo de gráfico">
        <button
          type="button"
          className={`chart-toggle-btn${view === 'posicao' ? ' active' : ''}`}
          onClick={() => setView('posicao')}
        >
          Posição
        </button>
        <button
          type="button"
          className={`chart-toggle-btn${view === 'pontos' ? ' active' : ''}`}
          onClick={() => setView('pontos')}
        >
          Pontos
        </button>
      </div>

      {view === 'posicao' ? (
        <RankingEvolutionChart steps={history.steps} lines={history.lines} />
      ) : (
        <PointsEvolutionChart steps={history.steps} lines={history.pointsLines} />
      )}
    </section>
  )
}
