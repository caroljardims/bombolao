/**
 * Mescla participante legado (slug) na conta Firebase do mesmo e-mail.
 * Uso: npm run merge-participante -- colorados-do-inter caca sai4GT6tlSgEz9R4VnGfKQWgv9s1 Cacá
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Palpite, Partida } from '../src/lib/types'
import {
  calcularPontos,
  calcularPosicoes,
  contarEstatisticas,
  partidaEncerrada,
  temPalpite,
} from './lib/recalc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function findServiceAccountPath(): string | null {
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      return join(root, file)
    }
  }
  return existsSync(join(root, 'service-account.json')) ? join(root, 'service-account.json') : null
}

function initAdmin() {
  if (getApps().length > 0) return getFirestore()
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Service account não encontrada')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return getFirestore()
}

async function recalcAll(db: ReturnType<typeof getFirestore>, bolaoId: string) {
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidasMap = new Map<string, Partida>()
  partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

  const palpitesSnap = await bolaoRef.collection('palpites').get()
  const batchPalpites = db.batch()
  let palpitesAtualizados = 0

  for (const doc of palpitesSnap.docs) {
    const palpite = { id: doc.id, ...doc.data() } as Palpite
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida || !partidaEncerrada(partida)) continue

    let pontos = 0
    if (temPalpite(palpite)) {
      pontos = calcularPontos(
        { casa: partida.gols_casa!, fora: partida.gols_fora! },
        { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
      )
    }

    if (palpite.pontos !== pontos) {
      batchPalpites.update(doc.ref, { pontos })
      palpitesAtualizados++
    }
  }

  if (palpitesAtualizados > 0) await batchPalpites.commit()

  const participantesSnap = await bolaoRef.collection('participantes').get()
  const statsList: ({ id: string } & ReturnType<typeof contarEstatisticas>)[] = []

  for (const pDoc of participantesSnap.docs) {
    const palpitesDoParticipante = palpitesSnap.docs
      .filter((d) => d.data().participante_id === pDoc.id)
      .map((d) => ({ id: d.id, ...d.data() }) as Palpite)

    const stats = contarEstatisticas(palpitesDoParticipante, partidasMap)
    statsList.push({ id: pDoc.id, ...stats })
  }

  const posicoes = calcularPosicoes(statsList)
  const batchParticipantes = db.batch()

  for (const entry of statsList) {
    batchParticipantes.update(bolaoRef.collection('participantes').doc(entry.id), {
      total_pontos: entry.total_pontos,
      na_mosca: entry.na_mosca,
      acerto_resultado: entry.acerto_resultado,
      sem_aposta: entry.sem_aposta,
      posicao: posicoes.get(entry.id) ?? 99,
    })
  }

  await batchParticipantes.commit()
}

async function main() {
  const bolaoId = process.argv[2]
  const fromId = process.argv[3]
  const toId = process.argv[4]
  const displayName = process.argv[5]

  if (!bolaoId || !fromId || !toId) {
    console.error('Uso: npm run merge-participante -- <bolao-id> <id-legado> <firebase-uid> [nome]')
    process.exit(1)
  }

  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const fromRef = bolaoRef.collection('participantes').doc(fromId)
  const toRef = bolaoRef.collection('participantes').doc(toId)

  const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()])
  if (!fromSnap.exists) {
    console.error(`Participante legado "${fromId}" não encontrado`)
    process.exit(1)
  }
  if (!toSnap.exists) {
    console.error(`Participante destino "${toId}" não encontrado`)
    process.exit(1)
  }

  const fromData = fromSnap.data()!
  const toData = toSnap.data()!
  const nome = displayName ?? fromData.nome ?? toData.nome

  console.log(`Mesclando ${fromId} (${fromData.nome}) → ${toId} (${toData.nome})`)

  const fromPalpites = await bolaoRef.collection('palpites').where('participante_id', '==', fromId).get()
  const toPalpites = await bolaoRef.collection('palpites').where('participante_id', '==', toId).get()
  const toByPartida = new Map(toPalpites.docs.map((d) => [d.data().partida_id as string, d]))

  const batch = db.batch()
  let moved = 0
  let deleted = 0

  for (const doc of fromPalpites.docs) {
    const partidaId = doc.data().partida_id as string
    if (toByPartida.has(partidaId)) {
      batch.delete(doc.ref)
      deleted++
    } else {
      batch.update(doc.ref, { participante_id: toId })
      moved++
    }
  }

  await batch.commit()
  console.log(`  · ${moved} palpite(s) transferido(s), ${deleted} duplicata(s) removida(s)`)

  await toRef.set(
    {
      nome,
      email: toData.email ?? fromData.email,
      papel: toData.papel === 'admin' || fromData.papel === 'admin' ? 'admin' : 'membro',
    },
    { merge: true },
  )

  await fromRef.delete()
  console.log(`  · participante "${fromId}" removido`)

  const membrosiaRef = db.collection('users').doc(toId).collection('membrosias').doc(bolaoId)
  const membrosiaSnap = await membrosiaRef.get()
  if (membrosiaSnap.exists) {
    await membrosiaRef.update({
      papel: toData.papel === 'admin' || fromData.papel === 'admin' ? 'admin' : 'membro',
    })
  }

  const bolaoSnap = await bolaoRef.get()
  if (bolaoSnap.data()?.criadoPor === fromId) {
    await bolaoRef.update({ criadoPor: toId })
    console.log(`  · criadoPor do bolão atualizado para ${toId}`)
  }

  await recalcAll(db, bolaoId)
  console.log(`✅ Conta unificada como "${nome}" (${toId})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
