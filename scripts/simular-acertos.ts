/**
 * DEV ONLY — Simula um bolão mata-mata "100% certo" para um participante.
 *
 * Joga o bracket inteiro (16-avos → final + 3º lugar) com vencedores propagados
 * (o mandante sempre vence 2×1) e grava, para o participante alvo (por padrão o
 * criador do bolão):
 *   - cravada com TODOS os avançadores certos (+ campeão/vice)
 *   - flexível com todos os avançadores certos
 *   - placar exato de cada jogo (Stream C)
 *
 * Resultado: ranking ao vivo mostra pontuação máxima e o bracket marca ✓ em tudo.
 *
 * Só roda em bolões de teste (id começa com "teste", a menos de --force) e nunca
 * nos bolões protegidos.
 *
 * Uso:
 *   npm run simular-acertos -- --bolao-id teste-5
 *   npm run simular-acertos -- --bolao-id teste-5 --participante-id <uid>
 *   npm run simular-acertos -- --bolao-id teste-5 --dry-run
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { wc2026MataPartidas } from '../src/data/competicoes/wc2026Mata'
import { BRACKET_TEMPLATE, FASE_ORDER } from '../src/data/chaveBracketTemplate'
import { CAMPEAO_PICK, VICE_PICK } from '../src/lib/knockoutBracket'
import type { KnockoutFase } from '../src/lib/chave'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

const BLOQUEADOS = new Set(['colorados-do-inter'])

const FASE_LABEL: Record<KnockoutFase, string> = {
  r32: '16-avos de final',
  r16: 'Oitavas de final',
  qf: 'Quartas de final',
  sf: 'Semifinais',
  final: 'Final',
  terceiro: 'Disputa de 3º lugar',
}

const FASE_DATA: Record<KnockoutFase, string> = {
  r32: '2026-06-20',
  r16: '2026-06-22',
  qf: '2026-06-24',
  sf: '2026-06-26',
  terceiro: '2026-06-27',
  final: '2026-06-27',
}

function loadDotEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
  }
}

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const candidates = [join(root, 'service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) candidates.push(join(root, file))
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

function initAdmin(): Firestore {
  if (getApps().length > 0) return getFirestore()
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (jsonEnv?.trim()) {
    initializeApp({ credential: cert(JSON.parse(jsonEnv)), projectId: PROJECT_ID })
    return getFirestore()
  }
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Credenciais Firebase não encontradas.')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))), projectId: PROJECT_ID })
  return getFirestore()
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

interface SimNode {
  fase: KnockoutFase
  partidaId: string
  a: string
  b: string
  /** Vencedor (sempre o mandante nesta simulação). */
  winner: string
}

/** Resolve o bracket inteiro fazendo o mandante vencer todos os jogos. */
function simularBracket(): {
  nodes: Map<string, SimNode>
  winners: Map<string, string>
  champion: string
  vice: string
} {
  const r32 = wc2026MataPartidas()
  const byNo = new Map<number, { casa: string; fora: string }>()
  for (const p of r32) {
    const no = Number(p.id!.replace('r32-', ''))
    byNo.set(no, { casa: p.time_casa, fora: p.time_fora })
  }

  const nodes = new Map<string, SimNode>()
  const winners = new Map<string, string>()
  const teams = new Map<string, { a: string; b: string }>()

  const advancer = (from: string) => winners.get(from)!
  const loser = (from: string) => {
    const t = teams.get(from)!
    return t.a === winners.get(from) ? t.b : t.a
  }

  for (const fase of FASE_ORDER) {
    for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === fase)) {
      let a: string
      let b: string
      let partidaId: string

      if (node.r32) {
        const conf = byNo.get(node.r32.no)!
        a = conf.casa
        b = conf.fora
        partidaId = `r32-${node.r32.no}`
      } else {
        const takeA = node.feedA!
        const takeB = node.feedB!
        a = takeA.take === 'winner' ? advancer(takeA.from) : loser(takeA.from)
        b = takeB.take === 'winner' ? advancer(takeB.from) : loser(takeB.from)
        partidaId = node.id
      }

      const winner = a // mandante sempre vence
      teams.set(node.id, { a, b })
      winners.set(node.id, winner)
      nodes.set(node.id, { fase, partidaId, a, b, winner })
    }
  }

  const champion = winners.get('final')!
  const finalTeams = teams.get('final')!
  const vice = finalTeams.a === champion ? finalTeams.b : finalTeams.a
  return { nodes, winners, champion, vice }
}

async function run() {
  loadDotEnv()
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  const bolaoId = getArg('--bolao-id')
  if (!bolaoId) {
    console.error('Uso: npm run simular-acertos -- --bolao-id teste-5')
    process.exit(1)
  }
  if (BLOQUEADOS.has(bolaoId) || (!bolaoId.startsWith('teste') && !force)) {
    console.error(`✋ "${bolaoId}" não parece ser um bolão de teste. Use --force se tiver certeza.`)
    process.exit(1)
  }

  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const bolaoSnap = await bolaoRef.get()
  if (!bolaoSnap.exists) {
    console.error(`Bolão "${bolaoId}" não existe.`)
    process.exit(1)
  }
  const bolao = bolaoSnap.data()!
  const participanteId = getArg('--participante-id') ?? (bolao.criadoPor as string)
  if (!participanteId) {
    console.error('Não achei o participante (passe --participante-id <uid>).')
    process.exit(1)
  }
  console.log(`Bolão: ${bolaoId} · participante: ${participanteId}`)
  console.log(`Modalidade: ${bolao.modalidade ?? 'pontos'}  placarAtivo: ${bolao.regrasChave?.placarAtivo ?? false}`)

  const { nodes, winners, champion, vice } = simularBracket()

  // 1) Apaga partidas atuais e grava o bracket inteiro já jogado (mandante vence 2×1).
  const oldSnap = await bolaoRef.collection('partidas').get()
  const delBatch = db.batch()
  for (const d of oldSnap.docs) if (!dryRun) delBatch.delete(d.ref)
  if (!dryRun && oldSnap.size > 0) await delBatch.commit()
  console.log(`✓ ${oldSnap.size} partida(s) antiga(s) removida(s)`)

  const gamesBatch = db.batch()
  for (const node of nodes.values()) {
    if (!dryRun) {
      gamesBatch.set(bolaoRef.collection('partidas').doc(node.partidaId), {
        data: FASE_DATA[node.fase],
        hora: '16:00',
        fase: FASE_LABEL[node.fase],
        time_casa: node.a,
        time_fora: node.b,
        gols_casa: 2,
        gols_fora: 1,
        vencedor: 'casa',
        status_api: 'FINISHED' as const,
      })
    }
  }
  if (!dryRun) await gamesBatch.commit()
  console.log(`✓ ${nodes.size} jogo(s) gravado(s) como FINISHED`)
  console.log(`  🏆 Campeão: ${champion}   🥈 Vice: ${vice}`)

  // 2) Cravada + flexível com todos os avançadores certos.
  const cravadaPicks: Record<string, string> = {}
  const flex: Partial<Record<KnockoutFase, { picks: Record<string, string> }>> = {}
  for (const node of BRACKET_TEMPLATE) {
    const winner = winners.get(node.id)!
    if (node.fase === 'final') {
      cravadaPicks[CAMPEAO_PICK] = champion
      cravadaPicks[VICE_PICK] = vice
    } else {
      cravadaPicks[node.id] = winner
    }
    const f = node.fase
    if (!flex[f]) flex[f] = { picks: {} }
    flex[f]!.picks[node.id] = winner
  }

  if (!dryRun) {
    await bolaoRef.collection('palpitesChave').doc(participanteId).set(
      {
        participante_id: participanteId,
        cravada: { picks: cravadaPicks },
        flex,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true },
    )
  }
  console.log(`✓ cravada (${Object.keys(cravadaPicks).length} picks) + flexível gravadas`)

  // 3) Placar exato de cada jogo (Stream C).
  const palBatch = db.batch()
  for (const node of nodes.values()) {
    const id = `${participanteId}_${node.partidaId}`
    if (!dryRun) {
      palBatch.set(bolaoRef.collection('palpites').doc(id), {
        participante_id: participanteId,
        partida_id: node.partidaId,
        palpite_casa: 2,
        palpite_fora: 1,
        pontos: 9,
      })
    }
  }
  if (!dryRun) await palBatch.commit()
  console.log(`✓ ${nodes.size} palpite(s) de placar exato gravado(s)`)

  console.log(`\n${dryRun ? '(dry-run — nada gravado) ' : ''}Pronto. Abra /b/${bolaoId}/chave e /b/${bolaoId}`)
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
