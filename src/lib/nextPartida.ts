import { getKickoffDate, getHoje, isPastKickoff } from './dates'
import { partidaAoVivo, partidaEmCurso, partidaEncerrada, temPlacar } from './scoring'
import type { Palpite, Partida, Participante } from './types'

/** Duração típica de jogo (90'+acréscimos/prorrogação) para inferir fim quando status_api atrasa. */
const MATCH_DURATION_MS = 110 * 60 * 1000

export interface ApostaProximoJogo {
  participante: Participante
  palpite: Palpite | null
}

/** Jogo já passou para fins de exibir o próximo (mesmo com status_api desatualizado). */
export function partidaJaPassou(partida: Partida, now = new Date()): boolean {
  if (partidaEncerrada(partida)) return true
  if (!isPastKickoff(partida, now)) return false

  if (temPlacar(partida) && !partidaAoVivo(partida)) return true

  const elapsed = now.getTime() - getKickoffDate(partida).getTime()
  if (temPlacar(partida) && elapsed > MATCH_DURATION_MS) return true

  return false
}

/** Próximo jogo para exibir apostas: ao vivo, em curso, próximo kickoff ou pendente. */
export function findProximaPartida(partidas: Partida[], now = new Date()): Partida | null {
  if (partidas.length === 0) return null

  const candidatas = [...partidas]
    .filter((p) => !partidaJaPassou(p, now))
    .sort((a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime())

  if (candidatas.length === 0) return null

  const aoVivo = candidatas.find((p) => partidaAoVivo(p))
  if (aoVivo) return aoVivo

  const emCurso = candidatas.find((p) => partidaEmCurso(p, now))
  if (emCurso) return emCurso

  return candidatas.find((p) => !isPastKickoff(p, now)) ?? candidatas[0]
}

export interface JogosDoDiaResult {
  data: string
  jogos: Partida[]
}

/** Lista de jogos do dia em exibição: hoje (incl. encerrados) ou amanhã se todos de hoje passaram. */
export function resolveJogosDoDia(partidas: Partida[], now = new Date()): JogosDoDiaResult {
  const hoje = getHoje(now)
  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )

  const jogosHoje = sorted.filter((p) => p.data === hoje)
  if (jogosHoje.length > 0) {
    const todosPassaram = jogosHoje.every((p) => partidaJaPassou(p, now))
    if (!todosPassaram) {
      return { data: hoje, jogos: jogosHoje }
    }
  }

  const datas = [...new Set(sorted.map((p) => p.data))].sort()
  const proximaData = datas.find((d) => d > hoje)
  if (!proximaData) {
    return { data: hoje, jogos: jogosHoje }
  }

  return {
    data: proximaData,
    jogos: sorted.filter((p) => p.data === proximaData),
  }
}

export function indiceProximoJogo(jogos: Partida[], proxima: Partida | null): number {
  if (jogos.length === 0) return 0
  if (!proxima) return 0
  const idx = jogos.findIndex((p) => p.id === proxima.id)
  return idx >= 0 ? idx : 0
}

export function buildApostasDoJogo(
  participantes: Participante[],
  palpites: Palpite[],
  partidaId: string,
): ApostaProximoJogo[] {
  return participantes.map((participante) => ({
    participante,
    palpite:
      palpites.find(
        (p) => p.participante_id === participante.id && p.partida_id === partidaId,
      ) ?? null,
  }))
}
