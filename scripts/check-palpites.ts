import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { isFirebaseUid, slugify } from '../src/lib/slug'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function initAdmin() {
  if (getApps().length > 0) return getFirestore()
  const candidates = [join(root, 'service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) candidates.push(join(root, file))
  }
  const credPath = candidates.find((p) => existsSync(p))!
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))), projectId: 'bombolao-9ea22' })
  return getFirestore()
}

async function check() {
  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc('colorados-do-inter')

  // 1. Listar participantes
  const partsSnap = await bolaoRef.collection('participantes').get()
  const uidParts = partsSnap.docs.filter(d => isFirebaseUid(d.id))
  const slugParts = partsSnap.docs.filter(d => !isFirebaseUid(d.id))
  console.log('UID participants:', uidParts.map(d => `${d.id.slice(0,8)}… (${d.data().nome})`).join(', '))
  console.log('Slug participants:', slugParts.map(d => `${d.id} (${d.data().nome})`).join(', '))

  // 2. Contar palpites por participante_id
  const palSnap = await bolaoRef.collection('palpites').get()
  const counts = new Map<string, number>()
  for (const doc of palSnap.docs) {
    const pid = doc.data().participante_id as string
    counts.set(pid, (counts.get(pid) ?? 0) + 1)
  }
  console.log('\nPalpites por participante_id:')
  for (const [pid, count] of [...counts.entries()].sort()) {
    const isUid = isFirebaseUid(pid)
    const part = partsSnap.docs.find(d => d.id === pid)
    const nome = part?.data().nome ?? '?'
    console.log(`  ${isUid ? pid.slice(0,8)+'…' : pid} (${nome}): ${count}`)
  }
  console.log('\nTotal palpites:', palSnap.size)

  // 3. Detectar duplicatas (mesmo participante+partida com IDs diferentes)
  const seen = new Map<string, string[]>()
  for (const doc of palSnap.docs) {
    const d = doc.data()
    const key = `${d.participante_id}|${d.partida_id}`
    const list = seen.get(key) ?? []
    list.push(doc.id)
    seen.set(key, list)
  }
  const dups = [...seen.entries()].filter(([, ids]) => ids.length > 1)
  if (dups.length > 0) {
    console.log('\n⚠️  Palpites duplicados encontrados:')
    for (const [key, ids] of dups) console.log(`  ${key}: ${ids.join(', ')}`)
  } else {
    console.log('\n✅ Nenhum palpite duplicado (mesmo participante+partida).')
  }

  // 4. Verificar se 'caca' slug existe e se Caroline Siqueira tem UID
  const caroline = uidParts.find(d => slugify(d.data().nome) === 'caroline-siqueira')
  const cacaSlug = slugParts.find(d => d.id === 'caca')
  if (caroline && cacaSlug) {
    console.log(`\n💡 'caca' (Cacá) pode ser migrada para UID ${caroline.id.slice(0,8)}… (${caroline.data().nome})`)
  }
}

check().catch(err => { console.error(err); process.exit(1) })
