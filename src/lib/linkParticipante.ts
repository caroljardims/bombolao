import {
  collectionGroup,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { bolaoDoc, membrosiaDoc, participanteDoc, participantesRef, palpitesRef } from './paths'
import type { Bolao, Participante } from './types'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findLegacyParticipantes(
  bolaoId: string,
  email: string,
  uid: string,
): Promise<Participante[]> {
  const normalized = normalizeEmail(email)
  if (!normalized) return []

  const snap = await getDocs(
    query(participantesRef(bolaoId), where('email', '==', normalized)),
  )

  return snap.docs
    .filter((d) => d.id !== uid)
    .map((d) => ({ id: d.id, ...d.data() }) as Participante)
}

/** Docs de participante a atualizar (uid + legado por e-mail). */
export async function participanteDocsForUser(
  bolaoId: string,
  uid: string,
  email: string | null | undefined,
) {
  const refs: ReturnType<typeof participanteDoc>[] = []
  const seen = new Set<string>()

  function add(id: string) {
    if (seen.has(id)) return
    seen.add(id)
    refs.push(participanteDoc(bolaoId, id))
  }

  const uidSnap = await getDoc(participanteDoc(bolaoId, uid))
  if (uidSnap.exists()) add(uid)

  if (email) {
    const snap = await getDocs(
      query(participantesRef(bolaoId), where('email', '==', normalizeEmail(email))),
    )
    for (const d of snap.docs) add(d.id)
  }

  if (refs.length === 0) add(uid)
  return refs
}

/**
 * Vincula participante legado (slug do seed/migração) à conta Firebase do mesmo e-mail.
 * Transfere palpites, preserva nome/pontuação e remove o doc duplicado.
 */
export async function claimLegacyParticipante(
  bolaoId: string,
  uid: string,
  email: string,
  nomeExibicao?: string,
): Promise<boolean> {
  const legacies = await findLegacyParticipantes(bolaoId, email, uid)
  if (legacies.length === 0) return false

  const uidRef = participanteDoc(bolaoId, uid)
  const uidSnap = await getDoc(uidRef)
  const uidPalpitesSnap = await getDocs(
    query(palpitesRef(bolaoId), where('participante_id', '==', uid)),
  )
  const uidByPartida = new Map(
    uidPalpitesSnap.docs.map((d) => [d.data().partida_id as string, d]),
  )

  const batch = writeBatch(db)
  const nome =
    nomeExibicao?.trim() ||
    legacies[0]?.nome ||
    normalizeEmail(email).split('@')[0]

  for (const legacy of legacies) {
    const legacyPalpites = await getDocs(
      query(palpitesRef(bolaoId), where('participante_id', '==', legacy.id)),
    )

    for (const doc of legacyPalpites.docs) {
      const partidaId = doc.data().partida_id as string
      if (uidByPartida.has(partidaId)) {
        batch.delete(doc.ref)
      } else {
        batch.update(doc.ref, { participante_id: uid })
        uidByPartida.set(partidaId, doc)
      }
    }

    batch.delete(participanteDoc(bolaoId, legacy.id))
  }

  const primary = legacies[0]
  if (!uidSnap.exists()) {
    batch.set(uidRef, {
      nome,
      email: normalizeEmail(email),
      total_pontos: primary.total_pontos ?? 0,
      na_mosca: primary.na_mosca ?? 0,
      acerto_resultado: primary.acerto_resultado ?? 0,
      sem_aposta: primary.sem_aposta ?? 0,
      posicao: primary.posicao ?? 99,
      papel: legacies.some((l) => l.papel === 'admin') ? 'admin' : (primary.papel ?? 'membro'),
      entrouEm: primary.entrouEm ?? new Date().toISOString(),
    })
  } else if (nomeExibicao?.trim()) {
    batch.update(uidRef, { nome: nomeExibicao.trim() })
  }

  await batch.commit()
  await ensureMembrosia(bolaoId, uid, {
    papel: legacies.some((l) => l.papel === 'admin') ? 'admin' : (primary.papel ?? 'membro'),
  })
  return true
}

/** Cria membrosia no lobby se o usuário ainda não tiver entrada para o bolão. */
export async function ensureMembrosia(
  bolaoId: string,
  uid: string,
  opts?: { papel?: 'admin' | 'membro' },
): Promise<void> {
  const mRef = membrosiaDoc(uid, bolaoId)
  const existing = await getDoc(mRef)
  if (existing.exists()) return

  const bolaoSnap = await getDoc(bolaoDoc(bolaoId))
  const bolao = bolaoSnap.exists() ? ({ id: bolaoSnap.id, ...bolaoSnap.data() } as Bolao) : null

  await setDoc(mRef, {
    bolaoId,
    nome: bolao?.nome ?? bolaoId,
    papel: opts?.papel ?? 'membro',
    entrouEm: new Date().toISOString(),
  })
}

/**
 * No login, vincula participantes legados (seed/migração) pelo e-mail
 * e garante que o bolão apareça no lobby.
 */
export async function syncLegacyMemberships(
  uid: string,
  email: string,
  nomeExibicao?: string,
): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return

  const snap = await getDocs(
    query(collectionGroup(db, 'participantes'), where('email', '==', normalized)),
  )

  const bolaoIds = new Set<string>()
  for (const doc of snap.docs) {
    if (doc.id === uid) continue
    const bolaoRef = doc.ref.parent.parent
    if (!bolaoRef) continue
    bolaoIds.add(bolaoRef.id)
  }

  for (const bolaoId of bolaoIds) {
    await claimLegacyParticipante(bolaoId, uid, email, nomeExibicao)
  }
}
