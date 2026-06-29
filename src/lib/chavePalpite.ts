import { setDoc } from 'firebase/firestore'
import { palpiteChaveDoc } from './paths'
import type { KnockoutFase } from './chave'
import type { ChavePicks, KnockoutEngine } from './knockoutBracket'
import type { RegrasChave } from './types'
import type { PalpiteChaveDoc } from './chavePalpiteModel'

export type {
  CravadaPalpite,
  FlexFasePalpite,
  PalpiteChaveDoc,
} from './chavePalpiteModel'
export { cravadaPicks, flexPicks } from './chavePalpiteModel'

function nowIso(): string {
  return new Date().toISOString()
}

/** Salva (merge) os picks da chave cravada. */
export async function saveCravada(
  bolaoId: string,
  participanteId: string,
  picks: ChavePicks,
): Promise<void> {
  await setDoc(
    palpiteChaveDoc(bolaoId, participanteId),
    {
      participante_id: participanteId,
      cravada: { picks },
      atualizadoEm: nowIso(),
    },
    { merge: true },
  )
}

/** Trava explicitamente a chave cravada (ação definitiva, pode ocorrer a qualquer momento). */
export async function lockCravada(bolaoId: string, participanteId: string): Promise<void> {
  await setDoc(
    palpiteChaveDoc(bolaoId, participanteId),
    {
      participante_id: participanteId,
      cravada: { travadoEm: nowIso() },
      atualizadoEm: nowIso(),
    },
    { merge: true },
  )
}

/** Salva (merge) os picks da chave flexível para uma fase. */
export async function saveFlexFase(
  bolaoId: string,
  participanteId: string,
  fase: KnockoutFase,
  picks: ChavePicks,
): Promise<void> {
  await setDoc(
    palpiteChaveDoc(bolaoId, participanteId),
    {
      participante_id: participanteId,
      flex: { [fase]: { picks } },
      atualizadoEm: nowIso(),
    },
    { merge: true },
  )
}

// ─── Prazos / travas ──────────────────────────────────────────────────────

function deadlineFor(kickoff: Date | null, prazoMinutos: number): Date | null {
  if (!kickoff) return null
  return new Date(kickoff.getTime() - prazoMinutos * 60 * 1000)
}

/**
 * A cravada fica aberta até o travamento manual. Não há prazo global: cada
 * confronto tem seu próprio prazo (o apito do jogo) — ver `engineToCravada`.
 * Quem não palpitar antes de um jogo começar apenas perde aqueles pontos.
 */
export function cravadaAberta(doc: PalpiteChaveDoc | null): boolean {
  return !doc?.cravada?.travadoEm
}

/** Prazo de uma fase flexível: apito do 1º jogo da fase − prazo. */
export function flexFaseDeadline(
  engine: KnockoutEngine,
  fase: KnockoutFase,
  regras: RegrasChave,
): Date | null {
  return deadlineFor(engine.primeiroKickoff.get(fase) ?? null, regras.prazo_minutos)
}

export function flexFaseAberta(
  engine: KnockoutEngine,
  fase: KnockoutFase,
  regras: RegrasChave,
  doc: PalpiteChaveDoc | null,
  now: Date = new Date(),
): boolean {
  if (doc?.flex?.[fase]?.travadoEm) return false
  const deadline = flexFaseDeadline(engine, fase, regras)
  if (!deadline) return true
  return now < deadline
}
