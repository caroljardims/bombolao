import { getDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { generateInviteCode } from './inviteCode'
import {
  bolaoDoc,
  conviteDoc,
  membrosiaDoc,
  partidaDoc,
  participanteDoc,
} from './paths'
import { slugify } from './slug'
import type { CriarBolaoInput } from './types'

function partidaIdFromFields(data: string, hora: string, casa: string, fora: string): string {
  const casaSlug = slugify(casa).slice(0, 12).toUpperCase()
  const foraSlug = slugify(fora).slice(0, 12).toUpperCase()
  return `${data}-${hora.replace(':', '')}-${casaSlug}-${foraSlug}`
}

async function uniqueBolaoId(nome: string): Promise<string> {
  let base = slugify(nome) || 'bolao'
  let candidate = base
  let n = 2
  while ((await getDoc(bolaoDoc(candidate))).exists()) {
    candidate = `${base}-${n}`
    n++
  }
  return candidate
}

export async function criarBolao(
  input: CriarBolaoInput,
  uid: string,
  email: string,
  nomeExibicao: string,
): Promise<{ bolaoId: string; inviteCode: string }> {
  if (!input.nome.trim()) throw new Error('Informe o nome do bolão.')
  if (!input.competicao.trim()) throw new Error('Informe a competição.')
  if (input.partidas.length === 0) throw new Error('Adicione pelo menos uma partida.')

  const bolaoId = await uniqueBolaoId(input.nome)
  const now = new Date().toISOString()
  const inviteCode = generateInviteCode()

  const batch = writeBatch(db)

  batch.set(bolaoDoc(bolaoId), {
    nome: input.nome.trim(),
    competicao: input.competicao.trim(),
    criadoPor: uid,
    criadoEm: now,
    acesso: input.acesso,
    regras: input.regras,
  })

  for (const p of input.partidas) {
    const id = partidaIdFromFields(p.data, p.hora, p.time_casa, p.time_fora)
    batch.set(partidaDoc(bolaoId, id), {
      data: p.data,
      hora: p.hora,
      fase: p.fase,
      time_casa: p.time_casa.trim(),
      time_fora: p.time_fora.trim(),
      gols_casa: null,
      gols_fora: null,
    })
  }

  batch.set(participanteDoc(bolaoId, uid), {
    nome: nomeExibicao.trim() || input.nome.trim(),
    email: email.toLowerCase(),
    total_pontos: 0,
    na_mosca: 0,
    acerto_resultado: 0,
    sem_aposta: 0,
    posicao: 1,
    papel: 'admin',
    entrouEm: now,
  })

  batch.set(membrosiaDoc(uid, bolaoId), {
    bolaoId,
    nome: input.nome.trim(),
    papel: 'admin',
    entrouEm: now,
  })

  batch.set(conviteDoc(inviteCode), {
    bolaoId,
    criadoPor: uid,
    ativo: true,
    maxUsos: 100,
    usos: 0,
    expiraEm: null,
  })

  await batch.commit()
  return { bolaoId, inviteCode }
}

export { partidaIdFromFields, uniqueBolaoId }
