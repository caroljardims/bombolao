/**
 * Atualiza placares das partidas a partir do seed + placar do dia web.bolão.
 * Uso: npm run update-partidas -- colorados-do-inter
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { SeedData } from '../src/lib/types'
import { recalcAll } from './lib/recalcAll'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Placar do dia web.bolão (14/06 tarde/noite) */
const WEB_BOLAO_PLACAR: Record<string, { gols_casa: number; gols_fora: number; status_api: string }> = {
  '2026-06-14-NED-JPN': { gols_casa: 0, gols_fora: 0, status_api: 'FINISHED' },
  '2026-06-14-CIV-ECU': { gols_casa: 0, gols_fora: 0, status_api: 'FINISHED' },
  '2026-06-14-SWE-TUN': { gols_casa: 0, gols_fora: 0, status_api: 'FINISHED' },
}

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
  const batch = db.batch()
  let updated = 0

  for (const partida of seed.partidas) {
    const overlay = WEB_BOLAO_PLACAR[partida.id]
    const gols_casa = overlay?.gols_casa ?? partida.gols_casa
    const gols_fora = overlay?.gols_fora ?? partida.gols_fora
    const status_api =
      overlay?.status_api ??
      (gols_casa !== null && gols_fora !== null ? 'FINISHED' : null)

    if (gols_casa === null || gols_fora === null) continue

    batch.set(
      bolaoRef.collection('partidas').doc(partida.id),
      { gols_casa, gols_fora, status_api },
      { merge: true },
    )
    updated++
  }

  await batch.commit()
  console.log(`✓ ${updated} partidas com placar atualizado`)
  await recalcAll(db, bolaoId)
  console.log('✓ Ranking recalculado')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
