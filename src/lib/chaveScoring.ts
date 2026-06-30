import { BRACKET_TEMPLATE } from '../data/chaveBracketTemplate'
import { cravadaPicks, flexPicks, type PalpiteChaveDoc } from './chavePalpiteModel'
import {
  CAMPEAO_PICK,
  VICE_PICK,
  type ChaveFlexPicks,
  type ChavePicks,
  type KnockoutEngine,
} from './knockoutBracket'
import { partidaEncerrada } from './scoring'
import type { PesosChave, RegrasChave } from './types'

export interface ChaveScoreBreakdown {
  /** Stream A — chave cravada. */
  cravada: number
  /** Stream B — chave flexível por fase. */
  flex: number
  total: number
}

/**
 * Final: dois picks pontuáveis e independentes — campeão (vence a final) e vice
 * (perde a final). Só pontua quando a final está encerrada.
 */
function scoreFinal(picks: ChavePicks, engine: KnockoutEngine, pesos: PesosChave): number {
  const finalPartida = engine.realPartida.get('final')
  if (!finalPartida || !partidaEncerrada(finalPartida)) return 0

  const campeaoReal = engine.realAdvancer.get('final') ?? null
  const viceReal = engine.realPerdedor.get('final') ?? null

  // Fallback para docs no formato antigo (campeão na chave `final`, sem vice):
  // o vice é o outro finalista, derivado dos picks de semifinal.
  const campeaoPick: string | null = picks[CAMPEAO_PICK] ?? picks['final'] ?? null
  let vicePick: string | null = picks[VICE_PICK] ?? null
  if (!vicePick && campeaoPick) {
    const fEsq = picks['sf-esq-1']
    const fDir = picks['sf-dir-1']
    vicePick = campeaoPick === fEsq ? fDir ?? null : campeaoPick === fDir ? fEsq ?? null : null
  }

  let pts = 0
  if (campeaoPick && campeaoPick === campeaoReal) pts += pesos.campeao
  if (vicePick && vicePick === viceReal) pts += pesos.vice
  return pts
}

/**
 * Stream A: para cada jogo, acerta o avançador → soma o peso da fase. Um time
 * que não chegou ao slot (eliminado antes) simplesmente não bate com o vencedor
 * real, então pontua 0 — sem necessidade de zerar manualmente o downstream. A
 * final é tratada à parte (campeão + vice).
 */
export function scoreCravada(
  picks: ChavePicks,
  engine: KnockoutEngine,
  pesos: PesosChave,
): number {
  let total = 0
  for (const node of BRACKET_TEMPLATE) {
    if (node.fase === 'final') continue
    const pick = picks[node.id]
    if (!pick) continue
    const real = engine.realAdvancer.get(node.id) ?? null
    if (real && pick === real) total += pesos[node.fase]
  }
  return total + scoreFinal(picks, engine, pesos)
}

/** Stream B: idêntico, mas com os picks por fase (cada fase é independente). */
export function scoreFlex(
  flex: ChaveFlexPicks,
  engine: KnockoutEngine,
  pesos: PesosChave,
): number {
  let total = 0
  for (const node of BRACKET_TEMPLATE) {
    const pick = flex[node.fase]?.[node.id]
    if (!pick) continue
    const real = engine.realAdvancer.get(node.id) ?? null
    if (real && pick === real) {
      total += node.fase === 'final' ? pesos.campeao : pesos[node.fase]
    }
  }
  return total
}

/** A cravada só pontua depois de travada (sem `travadoEm`, vale 0). */
export function cravadaTravada(doc: PalpiteChaveDoc | null): boolean {
  return !!doc?.cravada?.travadoEm
}

export function scoreChave(
  doc: PalpiteChaveDoc | null,
  engine: KnockoutEngine,
  regras: RegrasChave,
): ChaveScoreBreakdown {
  const cravada = cravadaTravada(doc)
    ? scoreCravada(cravadaPicks(doc), engine, regras.pesos_cravada)
    : 0
  const flex = scoreFlex(flexPicks(doc), engine, regras.pesos_flex)
  return { cravada, flex, total: cravada + flex }
}
