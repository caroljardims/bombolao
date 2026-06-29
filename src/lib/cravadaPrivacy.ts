import { BRACKET_TEMPLATE } from '../data/chaveBracketTemplate'
import { cravadaPicks, type PalpiteChaveDoc } from './chavePalpiteModel'
import {
  CAMPEAO_PICK,
  VICE_PICK,
  type ChavePicks,
  type KnockoutEngine,
} from './knockoutBracket'
import { partidaEncerrada } from './scoring'
import type { FaseChave } from './types'

export interface PicksVisiveis {
  /** Só picks de fases já encerradas (ou tudo, se for o dono). */
  picks: ChavePicks
  /** Fases cujos picks ainda estão ocultos para os outros participantes. */
  fasesAbertas: FaseChave[]
}

const FASES: FaseChave[] = ['r32', 'r16', 'qf', 'sf', 'final', 'terceiro']

/** Fase encerrada = todos os seus confrontos têm partida real encerrada. */
function faseEncerrada(fase: FaseChave, engine: KnockoutEngine): boolean {
  const nodes = BRACKET_TEMPLATE.filter((n) => n.fase === fase)
  if (nodes.length === 0) return false
  return nodes.every((n) => {
    const p = engine.realPartida.get(n.id)
    return p ? partidaEncerrada(p) : false
  })
}

/**
 * Filtra os picks de uma cravada conforme quem está olhando:
 * - dono: vê tudo;
 * - cravada já travada: pública para todos (a trava é definitiva, então revelar
 *   não permite mais cópia — quem travou assumiu o palpite);
 * - demais (não travada): só veem os picks de fases onde todos os jogos já encerraram.
 */
export function filtrarPicksVisiveis(
  doc: PalpiteChaveDoc | null,
  engine: KnockoutEngine,
  isOwner: boolean,
): PicksVisiveis {
  const all = cravadaPicks(doc)
  if (isOwner || doc?.cravada?.travadoEm) return { picks: { ...all }, fasesAbertas: [] }

  const picks: ChavePicks = {}
  const fasesAbertas: FaseChave[] = []

  for (const fase of FASES) {
    if (!faseEncerrada(fase, engine)) {
      fasesAbertas.push(fase)
      continue
    }
    if (fase === 'final') {
      if (all[CAMPEAO_PICK]) picks[CAMPEAO_PICK] = all[CAMPEAO_PICK]
      if (all[VICE_PICK]) picks[VICE_PICK] = all[VICE_PICK]
    } else {
      for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === fase)) {
        if (all[node.id]) picks[node.id] = all[node.id]
      }
    }
  }

  return { picks, fasesAbertas }
}
