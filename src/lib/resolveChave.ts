import type { ChaveData, KnockoutFase, KnockoutMatch, SlotRef } from './chave'
import { computeGroupStandings } from './standings'
import type { GroupStanding, GroupLetter } from './standings'
import { R32_TEMPLATE } from '../data/chaveR32Template'
import type { SlotSpec } from '../data/chaveR32Template'
import type { Partida } from './types'

const TBD: SlotRef = { tipo: 'placeholder', label: 'a definir' }

function resolveSlot(spec: SlotSpec, standings: Map<GroupLetter, GroupStanding>): SlotRef {
  if (spec.kind === 'third') {
    return { tipo: 'placeholder', label: `3º ${spec.groups.join('/')}` }
  }
  const pos = spec.kind === 'winner' ? 1 : 2
  const grupo = standings.get(spec.group)
  if (grupo?.complete) {
    const t = grupo.teams.find((x) => x.posicao === pos)
    if (t) return { tipo: 'time', nome: t.team }
  }
  return { tipo: 'placeholder', label: `${pos}º Grupo ${spec.group}` }
}

function placeholders(fase: KnockoutFase, lado: KnockoutMatch['lado'], count: number): KnockoutMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${fase}-${lado}-${i + 1}`,
    fase,
    lado,
    slot: i + 1,
    timeA: TBD,
    timeB: TBD,
  }))
}

/**
 * Monta a ChaveData ao vivo: 16-avos resolvidos a partir da classificação dos
 * grupos (1º/2º viram seleções quando o grupo encerra; 3º fica como conjunto),
 * e as fases seguintes como placeholders ("a definir").
 */
export function buildChaveData(partidas: Partida[]): ChaveData {
  const standings = computeGroupStandings(partidas)
  const matches: KnockoutMatch[] = []

  R32_TEMPLATE.forEach((tpl, idx) => {
    const lado = idx < 8 ? 'esq' : 'dir'
    const slot = (idx % 8) + 1
    matches.push({
      id: `r32-${tpl.no}`,
      fase: 'r32',
      lado,
      slot,
      timeA: resolveSlot(tpl.a, standings),
      timeB: resolveSlot(tpl.b, standings),
    })
  })

  matches.push(
    ...placeholders('r16', 'esq', 4),
    ...placeholders('r16', 'dir', 4),
    ...placeholders('qf', 'esq', 2),
    ...placeholders('qf', 'dir', 2),
    ...placeholders('sf', 'esq', 1),
    ...placeholders('sf', 'dir', 1),
  )

  matches.push({ id: 'final', fase: 'final', lado: 'centro', slot: 1, timeA: TBD, timeB: TBD })
  matches.push({ id: 'terceiro', fase: 'terceiro', lado: 'centro', slot: 1, timeA: TBD, timeB: TBD })

  return { competicao: 'Copa do Mundo 2026', matches }
}
