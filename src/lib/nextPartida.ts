import { getKickoffDate, isPastKickoff } from './dates'
import { partidaEncerrada } from './scoring'
import type { Palpite, Partida, Participante } from './types'

export interface ApostaProximoJogo {
  participante: Participante
  palpite: Palpite | null
}

export function findProximaPartida(partidas: Partida[], now = new Date()): Partida | null {
  if (partidas.length === 0) return null

  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )

  const upcoming = sorted.find((p) => !partidaEncerrada(p) && !isPastKickoff(p, now))
  if (upcoming) return upcoming

  return sorted.find((p) => !partidaEncerrada(p)) ?? null
}
