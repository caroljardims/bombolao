/**
 * Gera template estático de competição a partir da football-data.org.
 *
 * Uso:
 *   npm run generate-competicao-template
 *   npm run generate-competicao-template -- --id wc2026
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  apiMatchToPartidaImport,
  fetchCompetitionMatches,
  matchHasTeams,
} from './lib/footballData'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const TEMPLATES: Record<
  string,
  { id: string; nome: string; competicao: string; output: string }
> = {
  wc2026: {
    id: 'wc2026',
    nome: 'Copa do Mundo 2026',
    competicao: 'Copa do Mundo 2026',
    output: join(root, 'src/data/competicoes/wc2026.json'),
  },
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
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function getTemplateId(): string {
  const idx = process.argv.indexOf('--id')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return 'wc2026'
}

async function generateTemplate(templateId: string) {
  const meta = TEMPLATES[templateId]
  if (!meta) {
    throw new Error(`Template desconhecido: ${templateId}. Opções: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  console.log(`Buscando jogos da Copa (WC)…`)
  const apiMatches = await fetchCompetitionMatches()
  console.log(`· ${apiMatches.length} jogos na API`)

  const partidas: Array<{
    id: string
    data: string
    hora: string
    fase: string
    time_casa: string
    time_fora: string
  }> = []

  let pendentes = 0
  let ignorados = 0

  for (const apiMatch of apiMatches) {
    if (!matchHasTeams(apiMatch)) {
      pendentes++
      continue
    }

    const partidaImport = apiMatchToPartidaImport(apiMatch)
    if (!partidaImport) {
      ignorados++
      console.warn(`  ! Não foi possível mapear: ${apiMatch.homeTeam.name} × ${apiMatch.awayTeam.name}`)
      continue
    }

    partidas.push({
      id: partidaImport.id,
      data: partidaImport.data,
      hora: partidaImport.hora,
      fase: partidaImport.fase,
      time_casa: partidaImport.time_casa,
      time_fora: partidaImport.time_fora,
    })
  }

  partidas.sort((a, b) => {
    const da = `${a.data}T${a.hora}`
    const db = `${b.data}T${b.hora}`
    return da.localeCompare(db)
  })

  const output = {
    id: meta.id,
    nome: meta.nome,
    competicao: meta.competicao,
    partidas,
  }

  mkdirSync(dirname(meta.output), { recursive: true })
  writeFileSync(meta.output, `${JSON.stringify(output, null, 2)}\n`, 'utf-8')

  console.log(`\n✓ ${partidas.length} partida(s) gravadas em ${meta.output}`)
  console.log(`· ${pendentes} aguardando times (mata-mata)`)
  if (ignorados > 0) console.log(`· ${ignorados} não mapeada(s)`)
}

loadDotEnv()
generateTemplate(getTemplateId()).catch((err) => {
  console.error('Erro ao gerar template:', err)
  process.exit(1)
})
