import { LoadingState } from '../components/LoadingState'
import { MatchCard, MatchGroupHeader } from '../components/MatchCard'
import { useBolao } from '../contexts/BolaoContext'
import { usePartidas } from '../hooks/usePartidas'
import { isHoje } from '../lib/dates'

export function PartidasPage() {
  const { bolao } = useBolao()
  const { grouped, partidasHoje, competicao, loading, error } = usePartidas()

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

      {futureGroups.map(([data, partidas]) => (
        <div className="day-group" key={data}>
          <MatchGroupHeader data={data} count={partidas.length} />
          <div className="match-list">
            {partidas.map((p) => (
              <MatchCard key={p.id} partida={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
