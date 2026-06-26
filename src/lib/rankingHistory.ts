import { getKickoffDate } from './dates'
import { chartColorForParticipant, assignChartColors } from './chartColors'
import { contarEstatisticasLive } from './liveRanking'
import { calcularPosicoes, partidaAoVivo, partidaEncerrada, temPlacar } from './scoring'
import type { Palpite, Partida, Participante } from './types'

export interface PointsHistoryLine {
  participanteId: string
  nome: string
  photoURL?: string | null
  points: number[]
  color: string
}

export interface RankingHistoryStep {
  partida: Partida
  label: string
  posicoes: Map<string, number>
  pontos: Map<string, number>
}

export interface RankingHistoryLine {
  participanteId: string
  nome: string
  photoURL?: string | null
  positions: number[]
  color: string
}

function partidaContaParaHistorico(partida: Partida): boolean {
  return temPlacar(partida) && (partidaEncerrada(partida) || partidaAoVivo(partida))
}

function labelPartida(partida: Partida): string {
  return `${partida.time_casa} × ${partida.time_fora}`
}

export function buildRankingHistory(
  participantes: Participante[],
  palpites: Palpite[],
  partidas: Partida[],
): { steps: RankingHistoryStep[]; lines: RankingHistoryLine[]; pointsLines: PointsHistoryLine[] } {
  if (participantes.length === 0) {
    return { steps: [], lines: [], pointsLines: [] }
  }

  const sorted = [...partidas].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )
  const stepsPartidas = sorted.filter(partidaContaParaHistorico)

  const palpitesByParticipante = new Map<string, Palpite[]>()
  for (const palpite of palpites) {
    const list = palpitesByParticipante.get(palpite.participante_id) ?? []
    list.push(palpite)
    palpitesByParticipante.set(palpite.participante_id, list)
  }

  const steps: RankingHistoryStep[] = []

  for (let i = 0; i < stepsPartidas.length; i++) {
    const slice = stepsPartidas.slice(0, i + 1)
    const partidasMap = new Map(slice.map((p) => [p.id, p]))

    const withStats = participantes.map((p) => {
      const palpitesDoParticipante = (palpitesByParticipante.get(p.id) ?? []).filter((pl) =>
        partidasMap.has(pl.partida_id),
      )
      const stats = contarEstatisticasLive(palpitesDoParticipante, partidasMap)
      return { id: p.id, ...stats }
    })

    const posicoes = calcularPosicoes(withStats)
    const pontos = new Map(withStats.map((s) => [s.id, s.total_pontos]))
    steps.push({
      partida: stepsPartidas[i],
      label: labelPartida(stepsPartidas[i]),
      posicoes,
      pontos,
    })
  }

  const fallbackPos = participantes.length
  const colorById = assignChartColors(participantes.map((p) => p.id))

  const lines: RankingHistoryLine[] = participantes.map((p) => ({
    participanteId: p.id,
    nome: p.nome,
    photoURL: p.photoURL,
    positions: steps.map((s) => s.posicoes.get(p.id) ?? fallbackPos),
    color: colorById.get(p.id) ?? chartColorForParticipant(p.id),
  }))

  const pointsLines: PointsHistoryLine[] = participantes.map((p) => ({
    participanteId: p.id,
    nome: p.nome,
    photoURL: p.photoURL,
    points: steps.map((s) => s.pontos.get(p.id) ?? 0),
    color: colorById.get(p.id) ?? chartColorForParticipant(p.id),
  }))

  return { steps, lines, pointsLines }
}
