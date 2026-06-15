import { useMemo } from 'react'
import { LoadingState } from '../components/LoadingState'
import { MatchCard } from '../components/MatchCard'
import { MatchGameBets } from '../components/MatchGameBets'
import { PalpitesDaySection } from '../components/PalpitesDaySection'
import { RankingEvolutionChart } from '../components/RankingEvolutionChart'
import { useBolao } from '../contexts/BolaoContext'
import { usePartidas } from '../hooks/usePartidas'
import { getHoje, getKickoffDate } from '../lib/dates'
import { jogosPendentesDiasAnteriores, partidaJaPassou } from '../lib/nextPartida'
import type { Partida } from '../lib/types'
import { buildRankingHistory } from '../lib/rankingHistory'

function groupPartidasForDisplay(partidas: Partida[]): [string, Partida[]][] {
  const hoje = getHoje()
  const pendentes = jogosPendentesDiasAnteriores(partidas, hoje)
  const pendentesIds = new Set(pendentes.map((p) => p.id))

  const groups = new Map<string, Partida[]>()
  for (const p of partidas) {
    if (pendentesIds.has(p.id)) continue
    const list = groups.get(p.data) ?? []
    list.push(p)
    groups.set(p.data, list)
  }

  const hojeList = [...pendentes, ...(groups.get(hoje) ?? [])].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )
  if (hojeList.length > 0) {
    groups.set(hoje, hojeList)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, list]) => [
      data,
      [...list].sort((a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime()),
    ])
}

export function PartidasPage() {
  const { bolao } = useBolao()
  const { partidas, participantes, palpites, competicao, loading, error } = usePartidas()

  const rankingHistory = useMemo(
    () => buildRankingHistory(participantes, palpites, partidas),
    [participantes, palpites, partidas],
  )

  const dayGroups = useMemo(() => groupPartidasForDisplay(partidas), [partidas])
  const hoje = getHoje()

  if (loading) return <LoadingState message="Carregando partidas…" />
  if (error) {
    return <div className="alert-error">Erro ao carregar partidas: {error}</div>
  }

  const ultimaSync = bolao?.ultimaSyncApi
    ? new Date(bolao.ultimaSyncApi).toLocaleString('pt-BR')
    : null

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

      <div className="jogos-days">
        {dayGroups.map(([data, partidasDoDia]) => (
          <PalpitesDaySection
            key={data}
            data={data}
            count={partidasDoDia.length}
            defaultOpen={data >= hoje || partidasDoDia.some((p) => !partidaJaPassou(p))}
          >
            <div className="jogos-blocks">
              {partidasDoDia.map((partida) => (
                <div key={partida.id} className="jogo-block">
                  <MatchCard partida={partida} />
                  <MatchGameBets
                    partida={partida}
                    participantes={participantes}
                    palpites={palpites}
                    embedded
                  />
                </div>
              ))}
            </div>
          </PalpitesDaySection>
        ))}
      </div>
    </div>
  )
}
