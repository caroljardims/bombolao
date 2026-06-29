/**
 * Modelo e geometria do chaveamento (mata-mata) da Copa 2026.
 * Primeira iteração: somente visual (sem palpite/Firestore/pontuação).
 * Estrutura derivada de copa2026-chaveamento.md.
 */

import type { FaseChave, FaseScore, Partida } from './types'

export type KnockoutFase = FaseChave
export type BracketLado = 'esq' | 'dir' | 'centro'

export type SlotRef =
  | { tipo: 'time'; nome: string; projetado?: boolean }
  | { tipo: 'placeholder'; label: string }

export interface KnockoutMatch {
  id: string
  fase: KnockoutFase
  lado: BracketLado
  /** Posição dentro do lado/fase (1..n), de cima para baixo. */
  slot: number
  timeA: SlotRef
  timeB: SlotRef
  data?: string
  local?: string
  /** Partida real associada (placar/status), quando já existe no sync. */
  partida?: Partida
  /** Lado destacado (palpite atual do usuário ou vencedor real). */
  selecionado?: 'A' | 'B' | null
  /** Overlay de acertos: definido só quando há resultado real para comparar. */
  acertoA?: boolean
  acertoB?: boolean
  /** Se o usuário pode clicar para escolher o avançador. */
  editavel?: boolean
}

export interface ChaveData {
  competicao: string
  matches: KnockoutMatch[]
}

export const FASE_LABEL: Record<KnockoutFase, string> = {
  r32: '16-avos',
  r16: 'Oitavas',
  qf: 'Quartas',
  sf: 'Semifinal',
  final: 'Final',
  terceiro: '3º lugar',
}

/** Rótulos das chaves de scoring (inclui vice/campeão separados). */
export const FASE_SCORE_LABEL: Record<FaseScore, string> = {
  r32: '16-avos',
  r16: 'Oitavas',
  qf: 'Quartas',
  sf: 'Semifinal',
  terceiro: '3º lugar',
  vice: 'Vice-campeão',
  campeao: 'Campeão',
}

/** Ordem das fases, de fora para dentro do bracket. */
export const FASES_LADO: Exclude<KnockoutFase, 'final' | 'terceiro'>[] = ['r32', 'r16', 'qf', 'sf']

/** Round index (0 = 16avos, mais externo) por fase de lado. */
export const FASE_ROUND: Record<Exclude<KnockoutFase, 'final' | 'terceiro'>, number> = {
  r32: 0,
  r16: 1,
  qf: 2,
  sf: 3,
}

/** Quantidade de jogos por lado em cada round. */
export const ROUND_MATCHES = [8, 4, 2, 1] as const

// ─── Geometria do bracket espelhado ──────────────────────────────────────────

export const ROW_H = 24
export const MATCH_H = ROW_H * 2
export const V_GAP = 10
export const SLOT0 = MATCH_H + V_GAP
export const COL_W = 94
export const CONN_W = 14
export const HEADER_H = 22
export const HEADER_GAP = 10

/** Número total de colunas: 4 (esq) + 1 (centro) + 4 (dir). */
export const TOTAL_COLS = 9

/** Centro vertical de um jogo, dado o round (0 = 16avos) e o índice (0..n-1). */
export function matchCenterY(round: number, idx: number): number {
  if (round === 0) return idx * SLOT0 + MATCH_H / 2
  return (matchCenterY(round - 1, idx * 2) + matchCenterY(round - 1, idx * 2 + 1)) / 2
}

/** Altura do corpo do bracket (sem cabeçalho). */
export function bracketHeight(): number {
  return ROUND_MATCHES[0] * SLOT0 - V_GAP
}

/** Coluna (0..8) de um lado/round. Esquerda cresce p/ dentro; direita decresce. */
export function columnIndex(lado: BracketLado, round: number): number {
  if (lado === 'esq') return round
  if (lado === 'dir') return TOTAL_COLS - 1 - round
  return 4
}

/** X (px) da borda esquerda de uma coluna. */
export function columnX(col: number): number {
  return col * (COL_W + CONN_W)
}

export function bracketWidth(): number {
  return TOTAL_COLS * COL_W + (TOTAL_COLS - 1) * CONN_W
}

/** Y do topo do bracket (abaixo do cabeçalho das colunas). */
export const BODY_TOP = HEADER_H + HEADER_GAP

/** Agrupa os jogos por lado e fase, ordenados por slot. */
export function matchesByLadoFase(
  data: ChaveData,
  lado: BracketLado,
  fase: KnockoutFase,
): KnockoutMatch[] {
  return data.matches
    .filter((m) => m.lado === lado && m.fase === fase)
    .sort((a, b) => a.slot - b.slot)
}

export function slotLabel(ref: SlotRef): string {
  return ref.tipo === 'time' ? ref.nome : ref.label
}
