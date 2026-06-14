import type { AcertoTipo, Participante, ParticipanteStats, Partida, Palpite, Placar } from './types'
import { getKickoffDate, isPastKickoff } from './dates'

export function calcularPontos(
  placar: Placar,
  palpite: Placar,
): number {
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
const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])

export function temPlacar(partida: Partida): boolean {
  return partida.gols_casa !== null && partida.gols_fora !== null
}

export function partidaAoVivo(partida: Partida): boolean {
  return partida.status_api ? LIVE_STATUSES.has(partida.status_api) : false
}

/** Já começou (kickoff passou) mas ainda não tem resultado final. */
export function partidaEmCurso(partida: Partida, now: Date = new Date()): boolean {
  return isPastKickoff(partida, now) && !partidaEncerrada(partida)
}

export function partidaEncerrada(partida: Partida): boolean {
  if (!temPlacar(partida)) return false
  if (partida.status_api) return FINAL_STATUSES.has(partida.status_api)
  return true
}

export function temPalpite(palpite: Pick<Palpite, 'palpite_casa' | 'palpite_fora'>): boolean {
  return palpite.palpite_casa !== null && palpite.palpite_fora !== null
}

export function classificarAcerto(
  pontos: number | null,
  palpite: Pick<Palpite, 'palpite_casa' | 'palpite_fora'>,
  partidaEncerradaFlag: boolean,
): AcertoTipo {
  if (!temPalpite(palpite)) {
    if (partidaEncerradaFlag || isPastKickoff({ data: '', hora: '' } as Partida)) {
      return 'sem_aposta'
    }
    return 'sem_aposta'
  }
  if (pontos === null || !partidaEncerradaFlag) return 'nada'
  if (pontos === 9) return 'mosca'
  if (pontos === 6) return 'resultado_gol'
  if (pontos === 4) return 'resultado'
  if (pontos === 1) return 'gol'
  return 'nada'
}

export function classificarAcertoPalpite(
  palpite: Palpite,
  partida: Partida,
): AcertoTipo {
  const encerrada = partidaEncerrada(partida)
  if (!temPalpite(palpite)) {
    if (encerrada || isPastKickoff(partida)) return 'sem_aposta'
    return 'sem_aposta'
  }
  if (!encerrada) return 'nada'
  const pts = palpite.pontos ?? 0
  if (pts === 9) return 'mosca'
  if (pts === 6) return 'resultado_gol'
  if (pts === 4) return 'resultado'
  if (pts === 1) return 'gol'
  return 'nada'
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
      if (partidaEncerrada(partida) || isPastKickoff(partida)) {
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

export function calcularPosicoes(
  participantes: Pick<Participante, 'id' | 'total_pontos' | 'na_mosca' | 'acerto_resultado' | 'sem_aposta'>[],
): Map<string, number> {
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

export function apostasAbertas(partida: Partida, now: Date = new Date()): boolean {
  const kickoff = getKickoffDate(partida)
  const deadline = new Date(kickoff.getTime() - 15 * 60 * 1000)
  return now < deadline
}

export const ACERTO_STYLES: Record<AcertoTipo, { label: string; emoji: string; className: string }> = {
  mosca: { label: 'Na mosca', emoji: '🎯', className: 'bg-gold/20 text-gold border-gold/40' },
  resultado: { label: 'Resultado', emoji: '✅', className: 'bg-green-500/20 text-green-400 border-green-500/40' },
  resultado_gol: {
    label: 'Resultado + Gol',
    emoji: '✅',
    className: 'bg-green-500/20 text-green-400 border-green-500/40',
  },
  gol: { label: 'Gol', emoji: '⚽', className: 'bg-sky-400/20 text-sky-300 border-sky-400/40' },
  nada: { label: 'Nada', emoji: '❌', className: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
  sem_aposta: { label: 'Sem aposta', emoji: '⬜', className: 'bg-red-400/20 text-red-300 border-red-400/40' },
}
