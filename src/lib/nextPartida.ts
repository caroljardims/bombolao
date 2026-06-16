import { getKickoffDate, getHoje, isPastKickoff } from './dates'
import { partidaAoVivo, partidaEmCurso, partidaEncerrada } from './scoring'
import type { Palpite, Partida, Participante } from './types'

export interface ApostaProximoJogo {
  participante: Participante
  palpite: Palpite | null
}

/** Jogo já passou — apenas quando encerrado oficialmente (status_api FINISHED/AWARDED). */
export function partidaJaPassou(partida: Partida, _now = new Date()): boolean {
  return partidaEncerrada(partida)
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

/** Jogos de dias anteriores que ainda não terminaram (ex.: virou a meia-noite com jogo ao vivo). */
export function jogosPendentesDiasAnteriores(
  partidas: Partida[],
  hoje: string,
  now = new Date(),
): Partida[] {
  return partidas.filter((p) => p.data < hoje && !partidaJaPassou(p, now))
}

/**
 * Jogos do dia em exibição — alinhado ao jogo destacado em findProximaPartida.
 * Evita pular para amanhã enquanto ainda há jogo ao vivo, em curso ou aguardando kickoff hoje.
 */
export function resolveJogosDoDia(partidas: Partida[], now = new Date()): JogosDoDiaResult {
  const hoje = getHoje(now)
  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )

  const proxima = findProximaPartida(partidas, now)
  if (proxima) {
    const pendentesAnteriores = jogosPendentesDiasAnteriores(sorted, hoje, now)
    const jogosNaData = sorted.filter((p) => p.data === proxima.data)
    const jogos =
      proxima.data === hoje ? [...pendentesAnteriores, ...jogosNaData] : jogosNaData
    return { data: proxima.data, jogos }
  }

  const jogosHoje = sorted.filter((p) => p.data === hoje)
  return { data: hoje, jogos: jogosHoje }
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
