import { getDoc, runTransaction, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { generateInviteCode, normalizeInviteCode } from './inviteCode'
import { claimLegacyParticipante } from './linkParticipante'
import {
  bolaoDoc,
  conviteDoc,
  membrosiaDoc,
  participanteDoc,
} from './paths'
import type { Bolao, Convite } from './types'

export class JoinError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JoinError'
  }
}

export async function getConvite(code: string): Promise<Convite | null> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return null
  const snap = await getDoc(conviteDoc(normalized))
  if (!snap.exists()) return null
  return { code: snap.id, ...snap.data() } as Convite
}

export async function getBolao(bolaoId: string): Promise<Bolao | null> {
  const snap = await getDoc(bolaoDoc(bolaoId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Bolao
}

export async function isMember(bolaoId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(membrosiaDoc(uid, bolaoId))
  return snap.exists()
}

export async function joinBolaoByInvite(
  code: string,
  uid: string,
  email: string,
  nomeExibicao: string,
): Promise<string> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) throw new JoinError('Código de convite inválido.')

  const conviteSnap = await getDoc(conviteDoc(normalized))
  if (!conviteSnap.exists()) throw new JoinError('Convite não encontrado.')

  const convite = conviteSnap.data() as Omit<Convite, 'code'>
  if (!convite.ativo) throw new JoinError('Este convite não está mais ativo.')
  if (convite.expiraEm && new Date(convite.expiraEm) < new Date()) {
    throw new JoinError('Este convite expirou.')
  }
  if (convite.usos >= convite.maxUsos) {
    throw new JoinError('Este convite atingiu o limite de usos.')
  }

  const bolaoId = convite.bolaoId
  const membrosiaRef = membrosiaDoc(uid, bolaoId)
  const existingMembrosia = await getDoc(membrosiaRef)
  if (existingMembrosia.exists()) return bolaoId

  if (email) {
    await claimLegacyParticipante(bolaoId, uid, email, nomeExibicao)
  }

  await runTransaction(db, async (tx) => {
    const conviteRef = conviteDoc(normalized)
    const freshConvite = await tx.get(conviteRef)
    if (!freshConvite.exists()) throw new JoinError('Convite não encontrado.')

    const fresh = freshConvite.data() as Omit<Convite, 'code'>
    if (!fresh.ativo) throw new JoinError('Este convite não está mais ativo.')
    if (fresh.usos >= fresh.maxUsos) {
      throw new JoinError('Este convite atingiu o limite de usos.')
    }

    const bolaoSnap = await tx.get(bolaoDoc(bolaoId))
    if (!bolaoSnap.exists()) throw new JoinError('Bolão não encontrado.')

    const membrosia = await tx.get(membrosiaRef)
    if (membrosia.exists()) return

    const now = new Date().toISOString()
    const nome = nomeExibicao.trim() || email.split('@')[0]
    const participanteRef = participanteDoc(bolaoId, uid)
    const participanteSnap = await tx.get(participanteRef)

    if (!participanteSnap.exists()) {
      tx.set(participanteRef, {
        nome,
        email: email.toLowerCase(),
        total_pontos: 0,
        na_mosca: 0,
        acerto_resultado: 0,
        sem_aposta: 0,
        posicao: 99,
        papel: 'membro',
        entrouEm: now,
      })
    }

    tx.set(membrosiaRef, {
      bolaoId,
      nome: (bolaoSnap.data() as Bolao).nome,
      papel: participanteSnap.data()?.papel === 'admin' ? 'admin' : 'membro',
      entrouEm: now,
    })

    tx.update(conviteRef, { usos: fresh.usos + 1 })
  })

  return bolaoId
}

export async function joinBolaoAberto(
  bolaoId: string,
  uid: string,
  email: string,
  nomeExibicao: string,
): Promise<void> {
  const membrosiaRef = membrosiaDoc(uid, bolaoId)
  const existingMembrosia = await getDoc(membrosiaRef)
  if (existingMembrosia.exists()) return

  if (email) {
    await claimLegacyParticipante(bolaoId, uid, email, nomeExibicao)
  }

  await runTransaction(db, async (tx) => {
    const bolaoSnap = await tx.get(bolaoDoc(bolaoId))
    if (!bolaoSnap.exists()) throw new JoinError('Bolão não encontrado.')

    const bolao = bolaoSnap.data() as Bolao
    if (bolao.acesso !== 'aberto') {
      throw new JoinError('Este bolão requer convite para entrar.')
    }

    const membrosia = await tx.get(membrosiaRef)
    if (membrosia.exists()) return

    const now = new Date().toISOString()
    const nome = nomeExibicao.trim() || email.split('@')[0]
    const participanteRef = participanteDoc(bolaoId, uid)
    const participanteSnap = await tx.get(participanteRef)

    if (!participanteSnap.exists()) {
      tx.set(participanteRef, {
        nome,
        email: email.toLowerCase(),
        total_pontos: 0,
        na_mosca: 0,
        acerto_resultado: 0,
        sem_aposta: 0,
        posicao: 99,
        papel: 'membro',
        entrouEm: now,
      })
    }

    tx.set(membrosiaRef, {
      bolaoId,
      nome: bolao.nome,
      papel: participanteSnap.data()?.papel === 'admin' ? 'admin' : 'membro',
      entrouEm: now,
    })
  })
}

export async function criarConvite(
  bolaoId: string,
  uid: string,
  code: string,
  maxUsos = 100,
): Promise<string> {
  const inviteCode = code || generateInviteCode()
  const ref = conviteDoc(inviteCode)
  const existing = await getDoc(ref)
  if (existing.exists()) throw new JoinError('Código já em uso. Tente outro.')

  await setDoc(ref, {
    bolaoId,
    criadoPor: uid,
    ativo: true,
    maxUsos,
    usos: 0,
    expiraEm: null,
  })
  return inviteCode
}
