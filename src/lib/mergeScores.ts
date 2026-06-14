import type { Partida } from './types'
import type { LiveScore } from './scoresApi'
import { teamsMatch } from './teamMatch'

export function findLiveScoreForPartida(
  partida: Partida,
  scores: LiveScore[],
): LiveScore | undefined {
  return scores.find(
    (s) =>
      s.data === partida.data &&
      teamsMatch(s.home, partida.time_casa) &&
      teamsMatch(s.away, partida.time_fora),
  )
}

export function mergePartidasWithLiveScores(
  partidas: Partida[],
  scores: LiveScore[],
): Partida[] {
  if (scores.length === 0) return partidas

  return partidas.map((partida) => {
    const live = findLiveScoreForPartida(partida, scores)
    if (!live) return partida

    return {
      ...partida,
      gols_casa: live.gols_casa,
      gols_fora: live.gols_fora,
    }
  })
}

export function countLiveFromApi(partidas: Partida[], scores: LiveScore[]): number {
  return partidas.filter((p) => {
    const live = findLiveScoreForPartida(p, scores)
    return live?.status === 'live'
  }).length
}
