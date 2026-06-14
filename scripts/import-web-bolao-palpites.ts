/**
 * Importa palpites do seed.json para o bolão (mapeia nome → id atual no Firestore).
 * Uso: npm run import-palpites -- colorados-do-inter
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Partida, SeedData } from '../src/lib/types'
import { calcularPontos } from './lib/recalc'
import { recalcAll } from './lib/recalcAll'

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
  const bolaoId = process.argv[2] ?? 'colorados-do-inter'
  const db = initAdmin()
  const seed: SeedData = JSON.parse(readFileSync(join(root, 'src/data/seed.json'), 'utf-8'))
  const bolaoRef = db.collection('boloes').doc(bolaoId)

  const participantesSnap = await bolaoRef.collection('participantes').get()
  const nomeToId = new Map<string, string>()
  for (const doc of participantesSnap.docs) {
    nomeToId.set(doc.data().nome as string, doc.id)
  }

  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidasMap = new Map<string, Partida>()
  partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

  const batch = db.batch()
  let count = 0

  const allowedIds = new Set<string>()

  for (const [nome, palpites] of Object.entries(seed.palpites)) {
    const participanteId = nomeToId.get(nome)
    if (!participanteId) {
      console.warn(`  ! Participante não encontrado: ${nome}`)
      continue
    }

    for (const palpite of palpites) {
      const partida = partidasMap.get(palpite.partida_id)
      let pontos: number | null = null

      if (
        partida &&
        partida.gols_casa !== null &&
        partida.gols_fora !== null &&
        palpite.palpite_casa !== null &&
        palpite.palpite_fora !== null
      ) {
        pontos = calcularPontos(
          { casa: partida.gols_casa, fora: partida.gols_fora },
          { casa: palpite.palpite_casa, fora: palpite.palpite_fora },
        )
      }

      const id = `${participanteId}_${palpite.partida_id}`
      allowedIds.add(id)
      batch.set(
        bolaoRef.collection('palpites').doc(id),
        {
          participante_id: participanteId,
          partida_id: palpite.partida_id,
          palpite_casa: palpite.palpite_casa,
          palpite_fora: palpite.palpite_fora,
          pontos,
        },
        { merge: true },
      )
      count++
    }
  }

  const futurePath = join(root, 'src/data/web-bolao-future.json')
  if (existsSync(futurePath)) {
    const future = JSON.parse(readFileSync(futurePath, 'utf-8')) as {
      participante: string
      partida_id: string
      palpite_casa: number
      palpite_fora: number
    }[]
    for (const row of future) {
      const participanteId = nomeToId.get(row.participante)
      if (!participanteId) continue
      const id = `${participanteId}_${row.partida_id}`
      allowedIds.add(id)
      batch.set(
        bolaoRef.collection('palpites').doc(id),
        {
          participante_id: participanteId,
          partida_id: row.partida_id,
          palpite_casa: row.palpite_casa,
          palpite_fora: row.palpite_fora,
          pontos: null,
        },
        { merge: true },
      )
      count++
    }
  }

  await batch.commit()
  console.log(`✓ ${count} palpites importados`)

  const palpitesSnap = await bolaoRef.collection('palpites').get()
  const deleteBatch = db.batch()
  let removed = 0

  for (const doc of palpitesSnap.docs) {
    if (!allowedIds.has(doc.id)) {
      deleteBatch.delete(doc.ref)
      removed++
    }
  }

  if (removed > 0) {
    await deleteBatch.commit()
    console.log(`✓ ${removed} palpite(s) futuros removidos (não constam no web.bolão)`)
  }

  await recalcAll(db, bolaoId)
  console.log('✓ Ranking recalculado')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
