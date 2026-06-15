import { LoadingState } from '../components/LoadingState'
import { NextGameBets } from '../components/NextGameBets'
import { RankingCard } from '../components/RankingCard'
import { useLiveRanking } from '../hooks/useLiveRanking'

export function RankingPage() {
  const {
    ranking,
    loading,
    error,
    proximaPartida,
    jogosDoDia,
    participantes,
    palpites,
    refresh,
  } = useLiveRanking()

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
            {ranking.map((p) => (
              <RankingCard key={p.id} participante={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
