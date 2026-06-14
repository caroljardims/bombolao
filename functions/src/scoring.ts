import type { ParticipanteStats, Partida, Palpite, Placar } from './types'

export function calcularPontos(placar: Placar, palpite: Placar): number {
  if (palpite.casa === placar.casa && palpite.fora === placar.fora) return 9

  const resultadoReal = Math.sign(placar.casa - placar.fora)
  const resultadoPalpite = Math.sign(palpite.casa - palpite.fora)
  const acertouResultado = resultadoReal === resultadoPalpite

  const acertouGolCasa = palpite.casa === placar.casa
  const acertouGolFora = palpite.fora === placar.fora
  const acertouUmGol = acertouGolCasa || acertouGolFora

  if (resultadoReal === 0 && acertouResultado) return 6
  if (acertouResultado && acertouUmGol) return 6
  if (acertouResultado) return 4
  if (acertouUmGol) return 1
  return 0
}

const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED'])

export function partidaEncerrada(partida: Partida): boolean {
  if (partida.gols_casa === null || partida.gols_fora === null) return false
  if (partida.status_api) return FINAL_STATUSES.has(partida.status_api)
  return true
}

export function temPalpite(palpite: Pick<Palpite, 'palpite_casa' | 'palpite_fora'>): boolean {
  return palpite.palpite_casa !== null && palpite.palpite_fora !== null
}

export function contarEstatisticas(
  palpites: Palpite[],
  partidasMap: Map<string, Partida>,
): ParticipanteStats {
  let total_pontos = 0
  let na_mosca = 0
  let acerto_resultado = 0
  let sem_aposta = 0

  for (const palpite of palpites) {
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida) continue

    if (!temPalpite(palpite)) {
      if (partidaEncerrada(partida)) {
        sem_aposta += 1
      }
      continue
    }

    if (partidaEncerrada(partida) && palpite.pontos !== null) {
      total_pontos += palpite.pontos
      if (palpite.pontos === 9) na_mosca += 1
      if (palpite.pontos >= 4) acerto_resultado += 1
    }
  }

  return { total_pontos, na_mosca, acerto_resultado, sem_aposta }
}

interface ParticipanteComStats {
  id: string
  total_pontos: number
  na_mosca: number
  acerto_resultado: number
  sem_aposta: number
}

export function calcularPosicoes(participantes: ParticipanteComStats[]): Map<string, number> {
  const sorted = [...participantes].sort((a, b) => {
    if (b.total_pontos !== a.total_pontos) return b.total_pontos - a.total_pontos
    if (b.na_mosca !== a.na_mosca) return b.na_mosca - a.na_mosca
    if (b.acerto_resultado !== a.acerto_resultado) return b.acerto_resultado - a.acerto_resultado
    return a.sem_aposta - b.sem_aposta
  })

  const positions = new Map<string, number>()
  sorted.forEach((p, index) => positions.set(p.id, index + 1))
  return positions
}

export type { Partida, Palpite, Placar, ParticipanteStats }
