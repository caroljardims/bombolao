/**
 * Sincroniza palpites de um participante do seed.json para o Firestore.
 * Uso: npm run sync-participant-palpites -- Michael
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
  const nome = process.argv[2]
  const bolaoId = process.argv[3] ?? 'colorados-do-inter'
  if (!nome) throw new Error('Informe o nome do participante (ex.: Michael)')

  const db = initAdmin()
  const seed: SeedData = JSON.parse(readFileSync(join(root, 'src/data/seed.json'), 'utf-8'))
  const palpites = seed.palpites[nome]
  if (!palpites) throw new Error(`Participante "${nome}" não encontrado no seed`)

  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const participantesSnap = await bolaoRef.collection('participantes').get()
  const participanteDoc = participantesSnap.docs.find((d) => d.data().nome === nome)
  if (!participanteDoc) throw new Error(`Participante "${nome}" não encontrado no Firestore`)

  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidasMap = new Map<string, Partida>()
  partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

  const batch = db.batch()
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
    } else if (palpite.palpite_casa === null || palpite.palpite_fora === null) {
      pontos = partida?.gols_casa !== null && partida?.gols_fora !== null ? 0 : null
    }

    const id = `${participanteDoc.id}_${palpite.partida_id}`
    batch.set(
      bolaoRef.collection('palpites').doc(id),
      {
        participante_id: participanteDoc.id,
        partida_id: palpite.partida_id,
        palpite_casa: palpite.palpite_casa,
        palpite_fora: palpite.palpite_fora,
        pontos,
      },
      { merge: true },
    )
  }

  await batch.commit()
  console.log(`✓ ${palpites.length} palpites de ${nome} sincronizados (${participanteDoc.id})`)

  await recalcAll(db, bolaoId)
  console.log('✓ Ranking recalculado')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
