import { setDoc } from 'firebase/firestore'
import { palpiteChaveDoc } from './paths'
import type { KnockoutFase } from './chave'
import type { ChaveFlexPicks, ChavePicks, KnockoutEngine } from './knockoutBracket'
import type { RegrasChave } from './types'

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

/** Trava explicitamente a chave cravada (não impede a trava automática por prazo). */
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

/** Prazo da chave cravada: apito do 1º jogo dos 16-avos − prazo. */
export function cravadaDeadline(engine: KnockoutEngine, regras: RegrasChave): Date | null {
  return deadlineFor(engine.primeiroKickoff.get('r32') ?? null, regras.prazo_minutos)
}

export function cravadaAberta(
  engine: KnockoutEngine,
  regras: RegrasChave,
  doc: PalpiteChaveDoc | null,
  now: Date = new Date(),
): boolean {
  if (doc?.cravada?.travadoEm) return false
  const deadline = cravadaDeadline(engine, regras)
  if (!deadline) return true
  return now < deadline
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
