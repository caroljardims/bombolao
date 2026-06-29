import { useMemo, useState } from 'react'
import { LoadingState } from '../components/LoadingState'
import { NextGameBets } from '../components/NextGameBets'
import { RankingCard, type RankingView } from '../components/RankingCard'
import { RankingRaceCharts } from '../components/RankingRaceCharts'
import { useBolao } from '../contexts/BolaoContext'
import { useLiveRanking } from '../hooks/useLiveRanking'
import type { ParticipanteRanking } from '../lib/types'

const TABS: { id: RankingView; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'tradicional', label: 'Tradicional' },
  { id: 'cravada', label: 'Cravada' },
  { id: 'eliminatorias', label: 'Eliminatórias' },
]

const METRIC: Record<RankingView, (p: ParticipanteRanking) => number> = {
  geral: (p) => p.total_pontos,
  tradicional: (p) => (p.pontos_placar ?? 0) + (p.pontos_flex ?? 0),
  eliminatorias: (p) => (p.pontos_placar_elim ?? 0) + (p.pontos_flex ?? 0),
  cravada: (p) => p.pontos_cravada ?? 0,
}

/** Re-ordena e re-posiciona o ranking pela métrica da visão (empates compartilham posição). */
function rankByMetric(list: ParticipanteRanking[], view: RankingView): ParticipanteRanking[] {
  const metric = METRIC[view]
  const sorted = [...list].sort(
    (a, b) =>
      metric(b) - metric(a) ||
      b.na_mosca - a.na_mosca ||
      b.acerto_resultado - a.acerto_resultado ||
      a.sem_aposta - b.sem_aposta,
  )
  let posicao = 0
  let prev: number | null = null
  return sorted.map((p, i) => {
    const m = metric(p)
    if (prev === null || m !== prev) {
      posicao = i + 1
      prev = m
    }
    return { ...p, posicao }
  })
}

export function RankingPage() {
  const { bolao } = useBolao()
  const isMata = bolao?.modalidade === 'mata-mata'
  const [view, setView] = useState<RankingView>('geral')
  const {
    ranking,
    loading,
    error,
    proximaPartida,
    jogosDoDia,
    participantes,
    partidas,
    palpites,
    refresh,
  } = useLiveRanking()

  const viewRanking = useMemo(
    () => (isMata && view !== 'geral' ? rankByMetric(ranking, view) : ranking),
    [ranking, view, isMata],
  )

  async function handleRefresh() {
    await refresh()
  }

  if (loading && ranking.length === 0) {
    return <LoadingState message="Carregando ranking…" />
  }

  if (error && ranking.length === 0) {
    return (
      <div className="alert-error">
        <p>Erro ao carregar ranking: {error}</p>
        <button type="button" className="btn btn-ghost-gold" style={{ marginTop: 12 }} onClick={handleRefresh}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="screen ranking-screen">
      <div className="rank-grid">
        <NextGameBets
          jogosDoDia={jogosDoDia.jogos}
          proximaPartida={proximaPartida}
          participantes={participantes}
          palpites={palpites}
        />

        <section className="rank-main">
          <header className="section-head">
            <h2>Ranking</h2>
          </header>

          {isMata && (
            <div className="rank-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={view === t.id}
                  className={`rank-tab${view === t.id ? ' active' : ''}`}
                  onClick={() => setView(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {isMata && (
            <p className="rank-tab-hint">
              {view === 'geral'
                ? 'Soma de tudo: placar por jogo + flexível + cravada. Toque no card para ver o detalhe.'
                : view === 'tradicional'
                  ? 'Bolão tradicional: placar por jogo + flexível (sem a cravada).'
                  : view === 'eliminatorias'
                    ? 'Só as eliminatórias: placar por jogo + flexível do mata-mata (ignora grupos e cravada).'
                    : 'Apenas os pontos da cravada (chave travada no início).'}
            </p>
          )}

          <div className="rank-legend">
            <span>
              <i className="s-e">●</i> Cravou
            </span>
            <span>
              <i className="s-p">●</i> Acertou o resultado
            </span>
            <span>
              <i className="s-x">●</i> Não apostou
            </span>
          </div>

          <div className="rank-list">
            {viewRanking.map((p) => (
              <RankingCard key={p.id} participante={p} view={isMata ? view : 'geral'} />
            ))}
          </div>
        </section>
      </div>

      <RankingRaceCharts participantes={participantes} palpites={palpites} partidas={partidas} />
    </div>
  )
}
