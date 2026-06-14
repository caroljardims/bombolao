import type { Partida, Palpite, ParticipanteStats } from '../src/lib/types'

export function calcularPontos(
  placar: { casa: number; fora: number },
  palpite: { casa: number; fora: number },
): number {
  if (palpite.casa === placar.casa && palpite.fora === placar.fora) return 9
  const resultadoReal = Math.sign(placar.casa - placar.fora)
  const resultadoPalpite = Math.sign(palpite.casa - palpite.fora)
  const acertouResultado = resultadoReal === resultadoPalpite
  const acertouUmGol = palpite.casa === placar.casa || palpite.fora === placar.fora
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

export function temPalpite(p: Pick<Palpite, 'palpite_casa' | 'palpite_fora'>): boolean {
  return p.palpite_casa !== null && p.palpite_fora !== null
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
    if (!partida || !partidaEncerrada(partida)) continue

    if (!temPalpite(palpite)) {
      sem_aposta += 1
      continue
    }

    const pts = calcularPontos(
      { casa: partida.gols_casa!, fora: partida.gols_fora! },
      { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
    )
    total_pontos += pts
    if (pts === 9) na_mosca += 1
    if (pts >= 4) acerto_resultado += 1
  }

  return { total_pontos, na_mosca, acerto_resultado, sem_aposta }
}

export function calcularPosicoes(
  entries: ({ id: string } & ParticipanteStats)[],
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => {
    if (b.total_pontos !== a.total_pontos) return b.total_pontos - a.total_pontos
    if (b.na_mosca !== a.na_mosca) return b.na_mosca - a.na_mosca
    if (b.acerto_resultado !== a.acerto_resultado) return b.acerto_resultado - a.acerto_resultado
    return a.sem_aposta - b.sem_aposta
  })
  const map = new Map<string, number>()
  sorted.forEach((e, i) => map.set(e.id, i + 1))
  return map
}
