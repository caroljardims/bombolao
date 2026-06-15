import { getKickoffDate } from './dates'
import { contarEstatisticasLive } from './liveRanking'
import { calcularPosicoes, partidaAoVivo, partidaEncerrada, temPlacar } from './scoring'
import { teamFlag } from './teamFlags'
import type { Palpite, Partida, Participante } from './types'

export interface RankingHistoryStep {
  partida: Partida
  label: string
  posicoes: Map<string, number>
}

export interface RankingHistoryLine {
  participanteId: string
  nome: string
  photoURL?: string | null
  positions: number[]
  color: string
}

const LINE_COLORS = [
  '#f6c945',
  '#54c98a',
  '#5aa7f0',
  '#e9846b',
  '#b388f0',
  '#56cdd6',
  '#f0a35a',
  '#7bd06a',
] as const

function hashIdx(s: string, n: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % n
}

function partidaContaParaHistorico(partida: Partida): boolean {
  return temPlacar(partida) && (partidaEncerrada(partida) || partidaAoVivo(partida))
}

function labelPartida(partida: Partida): string {
  return `${teamFlag(partida.time_casa)}×${teamFlag(partida.time_fora)}`
}

export function buildRankingHistory(
  participantes: Participante[],
  palpites: Palpite[],
  partidas: Partida[],
): { steps: RankingHistoryStep[]; lines: RankingHistoryLine[] } {
  if (participantes.length === 0) {
    return { steps: [], lines: [] }
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
    steps.push({
      partida: stepsPartidas[i],
      label: labelPartida(stepsPartidas[i]),
      posicoes,
    })
  }

  const fallbackPos = participantes.length

  const lines: RankingHistoryLine[] = participantes.map((p) => ({
    participanteId: p.id,
    nome: p.nome,
    photoURL: p.photoURL,
    positions: steps.map((s) => s.posicoes.get(p.id) ?? fallbackPos),
    color: LINE_COLORS[hashIdx(p.id, LINE_COLORS.length)],
  }))

  return { steps, lines }
}
