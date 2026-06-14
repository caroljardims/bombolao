import { getKickoffDate, isPastKickoff } from './dates'
import { partidaAoVivo, partidaEmCurso, partidaEncerrada } from './scoring'
import type { Palpite, Partida, Participante } from './types'

export interface ApostaProximoJogo {
  participante: Participante
  palpite: Palpite | null
}

/** Próximo jogo para exibir apostas: ao vivo, em curso, próximo kickoff ou pendente. */
export function findProximaPartida(partidas: Partida[], now = new Date()): Partida | null {
  if (partidas.length === 0) return null

  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )

  const aoVivo = sorted.find((p) => partidaAoVivo(p))
  if (aoVivo) return aoVivo

  const emCurso = sorted.find((p) => partidaEmCurso(p, now))
  if (emCurso) return emCurso

  const proximoKickoff = sorted.find((p) => !isPastKickoff(p, now))
  if (proximoKickoff) return proximoKickoff

  return sorted.find((p) => !partidaEncerrada(p)) ?? null
}
