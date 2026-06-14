import {
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { participanteDoc, participantesRef, palpitesRef } from './paths'
import type { Participante } from './types'

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
  return true
}
