import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { slugify, isFirebaseUid } from '../src/lib/slug'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

function initAdmin() {
  if (getApps().length > 0) return getFirestore()
  const candidates = [join(root, 'service-account.json'), join(root, 'firebase-service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) candidates.push(join(root, file))
  }
  const credPath = candidates.find((p) => existsSync(p))
  if (!credPath) { console.error('Credenciais não encontradas'); process.exit(1) }
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))), projectId: PROJECT_ID })
  return getFirestore()
}

async function migrate() {
  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc('colorados-do-inter')

  const participantesSnap = await bolaoRef.collection('participantes').get()

  // Separar UID-based de slug-based
  const uidDocs = participantesSnap.docs.filter((d) => isFirebaseUid(d.id))
  const slugDocs = participantesSnap.docs.filter((d) => !isFirebaseUid(d.id))

  console.log(`UID-based: ${uidDocs.map((d) => `${d.id} (${d.data().nome})`).join(', ')}`)
  console.log(`Slug-based: ${slugDocs.map((d) => `${d.id} (${d.data().nome})`).join(', ')}`)

  // Mapear slug → UID pelo nome (slugify do nome do UID doc)
  const slugToUid = new Map<string, string>()
  for (const uidDoc of uidDocs) {
    const nome = uidDoc.data().nome as string
    const slug = slugify(nome)
    if (slugDocs.find((s) => s.id === slug)) {
      slugToUid.set(slug, uidDoc.id)
    }
  }

  console.log('\nMapeamento slug → UID:')
  for (const [slug, uid] of slugToUid) {
    console.log(`  ${slug} → ${uid}`)
  }

  if (slugToUid.size === 0) {
    console.log('Nada a migrar.')
    return
  }

  // Buscar todos os palpites
  const palpitesSnap = await bolaoRef.collection('palpites').get()

  const batch = db.batch()
  let migrated = 0
  let skipped = 0

  for (const pDoc of palpitesSnap.docs) {
    const data = pDoc.data()
    const uid = slugToUid.get(data.participante_id)
    if (!uid) { skipped++; continue }

    // Criar novo doc com UID-based participante_id
    const newId = `${uid}_${data.partida_id}`
    const newRef = bolaoRef.collection('palpites').doc(newId)
    batch.set(newRef, { ...data, participante_id: uid })
    // Deletar o antigo
    batch.delete(pDoc.ref)
    migrated++
  }

  // Deletar slug participant docs que têm UID counterpart
  for (const slug of slugToUid.keys()) {
    batch.delete(bolaoRef.collection('participantes').doc(slug))
  }

  await batch.commit()
  console.log(`\n✅ ${migrated} palpites migrados, ${skipped} ignorados, ${slugToUid.size} slugs removidos.`)
}

migrate().catch((err) => { console.error('Erro:', err); process.exit(1) })
