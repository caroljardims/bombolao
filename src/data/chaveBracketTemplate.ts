import type { BracketLado, KnockoutFase } from '../lib/chave'
import { R32_TEMPLATE, type SlotSpec } from './chaveR32Template'

/**
 * Árvore fixa do mata-mata da Copa 2026 (R32 → Final + 3º lugar), com lados
 * (esquerda/direita) e relações de alimentação entre as fases.
 *
 * A ordem dos 16-avos segue [chaveR32Template.ts](chaveR32Template.ts): os 8
 * primeiros confrontos ficam à esquerda e os 8 últimos à direita. Pares
 * adjacentes (slot 1+2, 3+4, …) alimentam o mesmo jogo da fase seguinte, o que
 * casa com a geometria espelhada de [chave.ts](../lib/chave.ts).
 */

export type Take = 'winner' | 'loser'

export interface BracketTemplateNode {
  id: string
  fase: KnockoutFase
  lado: BracketLado
  /** Posição dentro do lado/fase (1..n), de cima para baixo. */
  slot: number
  /** Origem dos confrontos dos 16-avos (1º/2º/3º de grupo). */
  r32?: { no: number; a: SlotSpec; b: SlotSpec }
  /** Nó que alimenta o time A (e se entra o vencedor ou o perdedor). */
  feedA?: { from: string; take: Take }
  feedB?: { from: string; take: Take }
}

const LADOS: Exclude<BracketLado, 'centro'>[] = ['esq', 'dir']

function nodeId(fase: KnockoutFase, lado: BracketLado, slot: number): string {
  if (fase === 'final') return 'final'
  if (fase === 'terceiro') return 'terceiro'
  return `${fase}-${lado}-${slot}`
}

function buildTemplate(): BracketTemplateNode[] {
  const nodes: BracketTemplateNode[] = []

  // 16-avos: 8 por lado, com a origem (grupo) vinda do template oficial.
  R32_TEMPLATE.forEach((tpl, idx) => {
    const lado: BracketLado = idx < 8 ? 'esq' : 'dir'
    const slot = (idx % 8) + 1
    nodes.push({
      id: nodeId('r32', lado, slot),
      fase: 'r32',
      lado,
      slot,
      r32: { no: tpl.no, a: tpl.a, b: tpl.b },
    })
  })

  // Fases internas por lado: cada jogo é alimentado por dois jogos adjacentes.
  const ladoRounds: { fase: KnockoutFase; prev: KnockoutFase; count: number }[] = [
    { fase: 'r16', prev: 'r32', count: 4 },
    { fase: 'qf', prev: 'r16', count: 2 },
    { fase: 'sf', prev: 'qf', count: 1 },
  ]

  for (const lado of LADOS) {
    for (const { fase, prev, count } of ladoRounds) {
      for (let i = 1; i <= count; i++) {
        nodes.push({
          id: nodeId(fase, lado, i),
          fase,
          lado,
          slot: i,
          feedA: { from: nodeId(prev, lado, i * 2 - 1), take: 'winner' },
          feedB: { from: nodeId(prev, lado, i * 2), take: 'winner' },
        })
      }
    }
  }

  // Final: vencedores das semifinais de cada lado.
  nodes.push({
    id: 'final',
    fase: 'final',
    lado: 'centro',
    slot: 1,
    feedA: { from: nodeId('sf', 'esq', 1), take: 'winner' },
    feedB: { from: nodeId('sf', 'dir', 1), take: 'winner' },
  })

  // Disputa de 3º lugar: perdedores das semifinais.
  nodes.push({
    id: 'terceiro',
    fase: 'terceiro',
    lado: 'centro',
    slot: 1,
    feedA: { from: nodeId('sf', 'esq', 1), take: 'loser' },
    feedB: { from: nodeId('sf', 'dir', 1), take: 'loser' },
  })

  return nodes
}

export const BRACKET_TEMPLATE: BracketTemplateNode[] = buildTemplate()

export const BRACKET_BY_ID: Map<string, BracketTemplateNode> = new Map(
  BRACKET_TEMPLATE.map((n) => [n.id, n]),
)

/** Para cada nó, quais nós o consomem (têm feed vindo dele). */
export const CONSUMERS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>()
  for (const node of BRACKET_TEMPLATE) {
    for (const feed of [node.feedA, node.feedB]) {
      if (!feed) continue
      const list = map.get(feed.from) ?? []
      list.push(node.id)
      map.set(feed.from, list)
    }
  }
  return map
})()

/** Ids de todos os nós que dependem (transitivamente) do resultado de `slotId`. */
export function descendentesDe(slotId: string): string[] {
  const out: string[] = []
  const stack = [...(CONSUMERS.get(slotId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (out.includes(id)) continue
    out.push(id)
    stack.push(...(CONSUMERS.get(id) ?? []))
  }
  return out
}

/** Ordem das fases da mais externa (16-avos) à decisão. */
export const FASE_ORDER: KnockoutFase[] = ['r32', 'r16', 'qf', 'sf', 'final', 'terceiro']
