/**
 * Remove um usuário (participante + membrosia + palpites) de um bolão e,
 * opcionalmente, apaga a conta no Firebase Auth.
 *
 * Uso:
 *   npm run delete-test-user -- <email> [bolaoId] [--keep-auth]
 *
 * Padrões:
 *   bolaoId = colorados-do-inter
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
  if (!credPath) throw new Error('Service account não encontrada na raiz do projeto')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return { db: getFirestore(), auth: getAuth() }
}

async function main() {
  const args = process.argv.slice(2)
  const keepAuth = args.includes('--keep-auth')
  const positional = args.filter((a) => !a.startsWith('--'))
  const email = positional[0]?.trim().toLowerCase()
  const bolaoId = positional[1] ?? 'colorados-do-inter'

  if (!email) {
    console.error('Uso: npm run delete-test-user -- <email> [bolaoId] [--keep-auth]')
    process.exit(1)
  }

  const { db, auth } = initAdmin()

  // Descobre o uid pela conta Auth (se existir)
  let uid: string | null = null
  try {
    uid = (await auth.getUserByEmail(email)).uid
  } catch {
    console.warn(`! nenhuma conta Auth para ${email}`)
  }

  const bolaoRef = db.collection('boloes').doc(bolaoId)

  // Remove participantes com esse e-mail (uid ou legado por slug)
  const participantesSnap = await bolaoRef.collection('participantes').where('email', '==', email).get()
  const ids = new Set<string>(participantesSnap.docs.map((d) => d.id))
  if (uid) ids.add(uid)

  let palpitesRemovidos = 0
  for (const id of ids) {
    const palpites = await bolaoRef.collection('palpites').where('participante_id', '==', id).get()
    for (const doc of palpites.docs) {
      await doc.ref.delete()
      palpitesRemovidos++
    }
    await bolaoRef.collection('participantes').doc(id).delete()
    if (uid) await db.collection('users').doc(id).collection('membrosias').doc(bolaoId).delete().catch(() => {})
  }
  console.log(`· participante(s) removido(s): ${[...ids].join(', ') || '(nenhum)'}`)
  console.log(`· palpites removidos: ${palpitesRemovidos}`)

  if (uid && !keepAuth) {
    await auth.deleteUser(uid)
    console.log(`· conta Auth apagada (uid ${uid})`)
  }

  console.log(`\n✅ ${email} removido de ${bolaoId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
