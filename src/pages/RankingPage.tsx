import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { NextGameBets } from '../components/NextGameBets'
import { RankingCard } from '../components/RankingCard'
import { Icon, Pill } from '../components/ui'
import { useBolao } from '../contexts/BolaoContext'
import { useLiveRanking } from '../hooks/useLiveRanking'
import { bolaoPath } from '../lib/paths'

export function RankingPage() {
  const { bolaoId, isAdmin } = useBolao()
  const {
    ranking,
    loading,
    refreshing,
    error,
    lastUpdate,
    aoVivo,
    encerradas,
    total,
    proximaPartida,
    jogosDoDia,
    participantes,
    palpites,
    refresh,
  } = useLiveRanking()

  async function handleRefresh() {
    try {
      await refresh()
      toast.success('Ranking atualizado!')
    } catch {
      toast.error('Erro ao atualizar ranking')
    }
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
            <div>
              <h2>Ranking</h2>
              <p className="sub">
                {encerradas}/{total} jogos com placar
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`btn btn-ghost-gold${refreshing ? ' spinning' : ''}`}
            >
              <Icon.refresh /> {refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
          </header>

          <div className="rank-statusbar">
            {aoVivo > 0 && (
              <Pill tone="live" dot>
                {aoVivo} jogo{aoVivo > 1 ? 's' : ''} ao vivo agora
              </Pill>
            )}
            <span className="upd">Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            {isAdmin && (
              <Link to={bolaoPath(bolaoId, 'admin')} className="admin-link">
                Administração <Icon.arrow s={14} />
              </Link>
            )}
          </div>

          <div className="rank-legend">
            <span>
              <i className="s-e">●</i> Na Mosca
            </span>
            <span>
              <i className="s-p">●</i> Resultados
            </span>
            <span>
              <i className="s-x">●</i> Sem aposta
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
