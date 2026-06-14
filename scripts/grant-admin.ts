/**
 * Concede papel admin a um participante por e-mail.
 * Uso: npm run grant-admin -- colorados-do-inter caroljardims@gmail.com
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
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
  if (getApps().length > 0) return getFirestore()
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Service account não encontrada')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return getFirestore()
}

async function main() {
  const bolaoId = process.argv[2]
  const email = process.argv[3]?.toLowerCase()
  const uidArg = process.argv[4]
  if (!bolaoId || !email) {
    console.error('Uso: npm run grant-admin -- <bolao-id> <email> [firebase-uid]')
    process.exit(1)
  }

  const db = initAdmin()
  const snap = await db.collection('boloes').doc(bolaoId).collection('participantes').get()
  const match = snap.docs.find((d) => (d.data().email as string)?.toLowerCase() === email)

  if (!match) {
    console.error(`Participante com e-mail ${email} não encontrado em boloes/${bolaoId}`)
    process.exit(1)
  }

  await match.ref.update({ papel: 'admin' })

  // Se participante antigo é slug, vincula admin à conta Firebase com membrosia
  let adminUid = match.id
  const usersSnap = await db.collection('users').get()
  for (const userDoc of usersSnap.docs) {
    const membrosiaRef = userDoc.ref.collection('membrosias').doc(bolaoId)
    const membrosiaSnap = await membrosiaRef.get()
    if (!membrosiaSnap.exists) continue

    const uid = userDoc.id
    const pRef = db.collection('boloes').doc(bolaoId).collection('participantes').doc(uid)
    const pSnap = await pRef.get()
    const pEmail = (pSnap.data()?.email as string | undefined)?.toLowerCase()

    if (pEmail === email || uid === match.id) {
      await membrosiaRef.update({ papel: 'admin' })
      if (pSnap.exists) await pRef.update({ papel: 'admin' })
      adminUid = uid
      console.log(`  · membrosia admin para uid ${uid}`)
    } else if (match.id.length < 20) {
      // Participante legado por slug: promove quem tem membrosia neste bolão
      await membrosiaRef.update({ papel: 'admin' })
      adminUid = uid
      console.log(`  · membrosia admin (legado) para uid ${uid}`)
    }
  }

  await db.collection('boloes').doc(bolaoId).update({ criadoPor: adminUid })

  if (uidArg) {
    const membrosiaRef = db.collection('users').doc(uidArg).collection('membrosias').doc(bolaoId)
    await membrosiaRef.set(
      { bolaoId, nome: (await db.collection('boloes').doc(bolaoId).get()).data()?.nome ?? bolaoId, papel: 'admin', entrouEm: new Date().toISOString() },
      { merge: true },
    )
    await db.collection('boloes').doc(bolaoId).collection('participantes').doc(uidArg).set(
      { email, nome: email.split('@')[0], papel: 'admin', entrouEm: new Date().toISOString(), total_pontos: 0, na_mosca: 0, acerto_resultado: 0, sem_aposta: 0, posicao: 99 },
      { merge: true },
    )
    await db.collection('boloes').doc(bolaoId).update({ criadoPor: uidArg })
    console.log(`  · admin concedido ao uid ${uidArg}`)
  }

  console.log(`✅ ${email} (${match.id}) é admin de ${bolaoId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
