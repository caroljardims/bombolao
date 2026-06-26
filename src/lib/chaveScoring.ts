import { BRACKET_TEMPLATE } from '../data/chaveBracketTemplate'
import { cravadaPicks, flexPicks, type PalpiteChaveDoc } from './chavePalpite'
import type { ChaveFlexPicks, ChavePicks, KnockoutEngine } from './knockoutBracket'
import type { PesosChave, RegrasChave } from './types'

export interface ChaveScoreBreakdown {
  /** Stream A — chave cravada. */
  cravada: number
  /** Stream B — chave flexível por fase. */
  flex: number
  total: number
}

/**
 * Stream A: para cada jogo, acerta o avançador → soma o peso da fase. Um time
 * que não chegou ao slot (eliminado antes) simplesmente não bate com o vencedor
 * real, então pontua 0 — sem necessidade de zerar manualmente o downstream.
 */
export function scoreCravada(
  picks: ChavePicks,
  engine: KnockoutEngine,
  pesos: PesosChave,
): number {
  let total = 0
  for (const node of BRACKET_TEMPLATE) {
    const pick = picks[node.id]
    if (!pick) continue
    const real = engine.realAdvancer.get(node.id) ?? null
    if (real && pick === real) total += pesos[node.fase]
  }
  return total
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
    if (real && pick === real) total += pesos[node.fase]
  }
  return total
}

export function scoreChave(
  doc: PalpiteChaveDoc | null,
  engine: KnockoutEngine,
  regras: RegrasChave,
): ChaveScoreBreakdown {
  const cravada = scoreCravada(cravadaPicks(doc), engine, regras.pesos_cravada)
  const flex = scoreFlex(flexPicks(doc), engine, regras.pesos_flex)
  return { cravada, flex, total: cravada + flex }
}
