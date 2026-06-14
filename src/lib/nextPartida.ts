import { getKickoffDate, isPastKickoff } from './dates'
import { partidaAoVivo, partidaEncerrada } from './scoring'
import type { Palpite, Partida, Participante } from './types'

export interface ApostaProximoJogo {
  participante: Participante
  palpite: Palpite | null
}

/** Próximo jogo para exibir apostas: ao vivo, ou próximo kickoff, ou pendente sem resultado final. */
export function findProximaPartida(partidas: Partida[], now = new Date()): Partida | null {
  if (partidas.length === 0) return null

  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )

  const aoVivo = sorted.find((p) => partidaAoVivo(p))
  if (aoVivo) return aoVivo

  const proximoKickoff = sorted.find((p) => !isPastKickoff(p, now))
  if (proximoKickoff) return proximoKickoff

  return sorted.find((p) => !partidaEncerrada(p)) ?? null
}
