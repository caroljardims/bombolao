import type { GroupLetter } from '../lib/standings'

/**
 * Template oficial dos 16-avos de final da Copa 2026 (jogos 73–88).
 * Fonte: FIFA / regulamento oficial (Annex C). Os confrontos 1º/2º são fixos;
 * os slots de "3º" dependem da matriz de 495 combinações (fora do escopo agora,
 * por isso ficam como conjunto de grupos possíveis).
 */

export type SlotSpec =
  | { kind: 'winner' | 'runnerup'; group: GroupLetter }
  | { kind: 'third'; groups: GroupLetter[] }

export interface R32TemplateMatch {
  no: number
  a: SlotSpec
  b: SlotSpec
}

const W = (group: GroupLetter): SlotSpec => ({ kind: 'winner', group })
const R = (group: GroupLetter): SlotSpec => ({ kind: 'runnerup', group })
const T = (...groups: GroupLetter[]): SlotSpec => ({ kind: 'third', groups })

/**
 * Ordem = posição no chaveamento oficial (não a ordem numérica dos jogos). Os 8
 * primeiros itens ocupam o lado esquerdo (metade de cima) e os 8 últimos o lado
 * direito (metade de baixo). Pares adjacentes (1+2, 3+4, …) cruzam nas oitavas,
 * conforme o bracket da FIFA:
 *
 *   esq: 74+77→W89, 73+75→W90, 83+84→W93, 81+82→W94
 *   dir: 76+78→W91, 79+80→W92, 86+88→W95, 85+87→W96
 */
export const R32_TEMPLATE: R32TemplateMatch[] = [
  // ── Lado esquerdo (metade de cima) ──
  { no: 74, a: W('E'), b: T('A', 'B', 'C', 'D', 'F') }, // esq slot 1 → W74
  { no: 77, a: W('I'), b: T('C', 'D', 'F', 'G', 'H') }, // esq slot 2 → W77
  { no: 73, a: R('A'), b: R('B') }, // esq slot 3 → W73
  { no: 75, a: W('F'), b: R('C') }, // esq slot 4 → W75
  { no: 83, a: R('K'), b: R('L') }, // esq slot 5 → W83
  { no: 84, a: W('H'), b: R('J') }, // esq slot 6 → W84
  { no: 81, a: W('D'), b: T('B', 'E', 'F', 'I', 'J') }, // esq slot 7 → W81
  { no: 82, a: W('G'), b: T('A', 'E', 'H', 'I', 'J') }, // esq slot 8 → W82
  // ── Lado direito (metade de baixo) ──
  { no: 76, a: W('C'), b: R('F') }, // dir slot 1 → W76
  { no: 78, a: R('E'), b: R('I') }, // dir slot 2 → W78
  { no: 79, a: W('A'), b: T('C', 'E', 'F', 'H', 'I') }, // dir slot 3 → W79
  { no: 80, a: W('L'), b: T('E', 'H', 'I', 'J', 'K') }, // dir slot 4 → W80
  { no: 86, a: W('J'), b: R('H') }, // dir slot 5 → W86
  { no: 88, a: R('D'), b: R('G') }, // dir slot 6 → W88
  { no: 85, a: W('B'), b: T('E', 'F', 'G', 'I', 'J') }, // dir slot 7 → W85
  { no: 87, a: W('K'), b: T('D', 'E', 'I', 'J', 'L') }, // dir slot 8 → W87
]
