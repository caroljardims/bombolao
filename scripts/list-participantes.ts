import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const root = process.cwd()
const cred = readdirSync(root).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'))
if (!getApps().length && cred) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(join(root, cred), 'utf-8'))) })
}
const db = getFirestore()
const bolaoId = process.argv[2] ?? 'colorados-do-inter'
const snap = await db.collection('boloes').doc(bolaoId).collection('participantes').get()
for (const d of snap.docs) console.log(d.id, d.data().email, d.data().papel)
