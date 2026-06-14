/**
 * Vincula participante legado ao Firebase Auth pelo e-mail e cria membrosia.
 * Uso: npm run link-participante -- colorados-do-inter f.brummello@gmail.com
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

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
  if (getApps().length > 0) return { db: getFirestore(), auth: getAuth() }
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Service account não encontrada')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return { db: getFirestore(), auth: getAuth() }
}

async function main() {
  const bolaoId = process.argv[2]
  const email = process.argv[3]?.trim().toLowerCase()

  if (!bolaoId || !email) {
    console.error('Uso: npm run link-participante -- <bolao-id> <email>')
    process.exit(1)
  }

  const { db, auth } = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const bolaoSnap = await bolaoRef.get()
  if (!bolaoSnap.exists) {
    console.error(`Bolão "${bolaoId}" não encontrado`)
    process.exit(1)
  }

  const legacySnap = await bolaoRef
    .collection('participantes')
    .where('email', '==', email)
    .get()

  const legacyDocs = legacySnap.docs.filter((d) => d.id.length < 28)
  if (legacyDocs.length === 0) {
    console.error(`Nenhum participante legado com e-mail ${email}`)
    process.exit(1)
  }

  let uid: string
  try {
    uid = (await auth.getUserByEmail(email)).uid
  } catch {
    console.error(`Conta Firebase Auth não encontrada para ${email}`)
    process.exit(1)
  }

  const primary = legacyDocs[0]
  const legacyData = primary.data()
  const nome = (legacyData.nome as string) || email.split('@')[0]
  const papel =
    legacyDocs.some((d) => d.data().papel === 'admin') || legacyData.papel === 'admin'
      ? 'admin'
      : 'membro'

  const uidRef = bolaoRef.collection('participantes').doc(uid)
  const uidPalpites = await bolaoRef.collection('palpites').where('participante_id', '==', uid).get()
  const uidByPartida = new Map(uidPalpites.docs.map((d) => [d.data().partida_id as string, d]))

  const batch = db.batch()
  let moved = 0

  for (const legacy of legacyDocs) {
    const palpites = await bolaoRef
      .collection('palpites')
      .where('participante_id', '==', legacy.id)
      .get()

    for (const doc of palpites.docs) {
      const partidaId = doc.data().partida_id as string
      if (uidByPartida.has(partidaId)) {
        batch.delete(doc.ref)
      } else {
        batch.update(doc.ref, { participante_id: uid })
        uidByPartida.set(partidaId, doc)
        moved++
      }
    }

    if (legacy.id !== uid) batch.delete(legacy.ref)
  }

  batch.set(
    uidRef,
    {
      nome,
      email,
      total_pontos: legacyData.total_pontos ?? 0,
      na_mosca: legacyData.na_mosca ?? 0,
      acerto_resultado: legacyData.acerto_resultado ?? 0,
      sem_aposta: legacyData.sem_aposta ?? 0,
      posicao: legacyData.posicao ?? 99,
      papel,
      entrouEm: legacyData.entrouEm ?? new Date().toISOString(),
    },
    { merge: true },
  )

  await batch.commit()
  console.log(`  · ${moved} palpite(s) transferido(s)`)
  console.log(`  · participante ${uid} criado/atualizado como "${nome}"`)

  const membrosiaRef = db.collection('users').doc(uid).collection('membrosias').doc(bolaoId)
  await membrosiaRef.set(
    {
      bolaoId,
      nome: bolaoSnap.data()?.nome ?? bolaoId,
      papel,
      entrouEm: new Date().toISOString(),
    },
    { merge: true },
  )
  console.log(`  · membrosia criada no lobby`)

  console.log(`✅ ${email} vinculado ao bolão ${bolaoId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
