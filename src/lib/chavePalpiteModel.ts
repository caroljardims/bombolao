import type { KnockoutFase } from './chave'
import type { ChaveFlexPicks, ChavePicks } from './knockoutBracket'

/**
 * Modelo puro do palpite de chave (sem dependência de Firebase) — pode ser
 * importado em testes Node. A camada de I/O fica em [chavePalpite.ts](chavePalpite.ts).
 */

export interface CravadaPalpite {
  picks: ChavePicks
  travadoEm?: string | null
}

export interface FlexFasePalpite {
  picks: ChavePicks
  travadoEm?: string | null
}

export interface PalpiteChaveDoc {
  participante_id: string
  cravada?: CravadaPalpite
  flex?: Partial<Record<KnockoutFase, FlexFasePalpite>>
  atualizadoEm?: string
}

/** Picks atuais da cravada (vazio se não houver). */
export function cravadaPicks(doc: PalpiteChaveDoc | null): ChavePicks {
  return doc?.cravada?.picks ?? {}
}

/** Picks flexíveis por fase (vazio se não houver). */
export function flexPicks(doc: PalpiteChaveDoc | null): ChaveFlexPicks {
  const out: ChaveFlexPicks = {}
  const flex = doc?.flex
  if (!flex) return out
  for (const fase of Object.keys(flex) as KnockoutFase[]) {
    out[fase] = flex[fase]?.picks ?? {}
  }
  return out
}
