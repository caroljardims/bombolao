import { useMemo } from 'react'
import { LoadingState } from '../components/LoadingState'
import { MatchCard, MatchGroupHeader } from '../components/MatchCard'
import { RankingEvolutionChart } from '../components/RankingEvolutionChart'
import { useBolao } from '../contexts/BolaoContext'
import { usePartidas } from '../hooks/usePartidas'
import { isHoje } from '../lib/dates'
import { buildRankingHistory } from '../lib/rankingHistory'

export function PartidasPage() {
  const { bolao } = useBolao()
  const { partidas, grouped, partidasHoje, pendentesIds, participantes, palpites, competicao, loading, error } =
    usePartidas()

  const rankingHistory = useMemo(
    () => buildRankingHistory(participantes, palpites, partidas),
    [participantes, palpites, partidas],
  )

  if (loading) return <LoadingState message="Carregando partidas…" />
  if (error) {
    return <div className="alert-error">Erro ao carregar partidas: {error}</div>
  }

  const ultimaSync = bolao?.ultimaSyncApi
    ? new Date(bolao.ultimaSyncApi).toLocaleString('pt-BR')
    : null

  const futureGroups = Array.from(grouped.entries()).filter(([data]) => !isHoje(data))

  return (
    <div className="screen jogos-screen">
      <header className="section-head plain">
        <div>
          <h2>Partidas</h2>
          <p className="sub">{competicao || 'Partidas'} · placares via sync automático</p>
          {ultimaSync && <p className="sub tiny">Último sync: {ultimaSync}</p>}
        </div>
      </header>

      <RankingEvolutionChart steps={rankingHistory.steps} lines={rankingHistory.lines} />

      {partidasHoje.length > 0 && (
        <div className="day-group">
          <h3 className="day-label">
            <span className="gold-text">Jogos de hoje</span>
            <span className="count">{partidasHoje.length}</span>
          </h3>
          <div className="match-list">
            {partidasHoje.map((p) => (
              <MatchCard key={p.id} partida={p} />
            ))}
          </div>
        </div>
      )}

      {futureGroups.map(([data, partidas]) => {
        const lista = partidas.filter((p) => !pendentesIds.has(p.id))
        if (lista.length === 0) return null
        return (
        <div className="day-group" key={data}>
          <MatchGroupHeader data={data} count={lista.length} />
          <div className="match-list">
            {lista.map((p) => (
              <MatchCard key={p.id} partida={p} />
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}
