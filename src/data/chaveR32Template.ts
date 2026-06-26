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

export const R32_TEMPLATE: R32TemplateMatch[] = [
  { no: 73, a: R('A'), b: R('B') },
  { no: 74, a: W('E'), b: T('A', 'B', 'C', 'D', 'F') },
  { no: 75, a: W('F'), b: R('C') },
  { no: 76, a: W('C'), b: R('F') },
  { no: 77, a: W('I'), b: T('C', 'D', 'F', 'G', 'H') },
  { no: 78, a: R('E'), b: R('I') },
  { no: 79, a: W('A'), b: T('C', 'E', 'F', 'H', 'I') },
  { no: 80, a: W('L'), b: T('E', 'H', 'I', 'J', 'K') },
  { no: 81, a: W('D'), b: T('B', 'E', 'F', 'I', 'J') },
  { no: 82, a: W('G'), b: T('A', 'E', 'H', 'I', 'J') },
  { no: 83, a: R('K'), b: R('L') },
  { no: 84, a: W('H'), b: R('J') },
  { no: 85, a: W('B'), b: T('E', 'F', 'G', 'I', 'J') },
  { no: 86, a: W('J'), b: R('H') },
  { no: 87, a: W('K'), b: T('D', 'E', 'I', 'J', 'L') },
  { no: 88, a: R('D'), b: R('G') },
]
