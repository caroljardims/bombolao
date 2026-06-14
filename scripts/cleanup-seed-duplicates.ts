import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { isFirebaseUid } from '../src/lib/slug'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

function initAdmin() {
  if (getApps().length > 0) return getFirestore()
  const candidates = [
    join(root, 'service-account.json'),
    join(root, 'firebase-service-account.json'),
  ]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      candidates.push(join(root, file))
    }
  }
  const credPath = candidates.find((p) => existsSync(p))
  if (!credPath) {
    console.error('Credenciais não encontradas')
    process.exit(1)
  }
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf-8'))
  initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID })
  return getFirestore()
}

async function cleanup() {
  const db = initAdmin()
  const bolaoId = 'colorados-do-inter'
  const bolaoRef = db.collection('boloes').doc(bolaoId)

  // 1. Deletar participantes com ID de slug (não são UIDs do Firebase)
  const participantesSnap = await bolaoRef.collection('participantes').get()
  const slugIds: string[] = []
  for (const doc of participantesSnap.docs) {
    if (!isFirebaseUid(doc.id)) {
      slugIds.push(doc.id)
      console.log(`Participante slug encontrado: ${doc.id} (${doc.data().nome})`)
    }
  }

  if (slugIds.length === 0) {
    console.log('Nenhum participante duplicado encontrado.')
    return
  }

  // 2. Deletar palpites vinculados a esses slugs
  const palpitesSnap = await bolaoRef.collection('palpites').get()
  const batch = db.batch()
  let palpitesCount = 0
  for (const doc of palpitesSnap.docs) {
    const data = doc.data()
    if (slugIds.includes(data.participante_id)) {
      batch.delete(doc.ref)
      palpitesCount++
    }
  }

  // 3. Deletar os participantes slug
  for (const slugId of slugIds) {
    batch.delete(bolaoRef.collection('participantes').doc(slugId))
  }

  await batch.commit()
  console.log(`✅ Removidos ${slugIds.length} participantes duplicados e ${palpitesCount} palpites vinculados.`)
}

cleanup().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
