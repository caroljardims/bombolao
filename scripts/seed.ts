import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import type { SeedData } from '../src/lib/types'
import { slugify } from '../src/lib/slug'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const candidates = [
    join(root, 'service-account.json'),
    join(root, 'firebase-service-account.json'),
  ]

  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      candidates.push(join(root, file))
    }
  }

  return candidates.find((p) => existsSync(p)) ?? null
}

function printCredentialHelp(): void {
  console.error(`
❌ Credenciais do Firebase Admin não encontradas.

O script precisa de uma Service Account para gravar no Firestore.

Como resolver:

1. Abra: https://console.firebase.google.com/project/bombolao-9ea22/settings/serviceaccounts/adminsdk
2. Clique em "Gerar nova chave privada" e baixe o JSON
3. Salve o arquivo na raiz do projeto como:
   service-account.json

4. Rode novamente:
   npm run seed

Alternativa (via variável de ambiente):
   GOOGLE_APPLICATION_CREDENTIALS=./caminho/para/chave.json npm run seed
`)
}

function initAdmin() {
  if (getApps().length > 0) return getFirestore()

  const credPath = findServiceAccountPath()

  if (credPath) {
    console.log(`Usando credenciais: ${credPath}`)
    const serviceAccount = JSON.parse(readFileSync(credPath, 'utf-8'))
    initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    })
    return getFirestore()
  }

  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    })
    return getFirestore()
  } catch {
    printCredentialHelp()
    process.exit(1)
  }
}

function getBolaoId(): string {
  const idx = process.argv.indexOf('--bolao-id')
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : 'colorados-do-inter'
}

async function seed() {
  const db = initAdmin()
  const bolaoId = getBolaoId()

  const seedData: SeedData = JSON.parse(
    readFileSync(join(root, 'src/data/seed.json'), 'utf-8'),
  )
  const emails: Record<string, string> = JSON.parse(
    readFileSync(join(root, 'src/data/participant-emails.json'), 'utf-8'),
  )

  const rankingMap = new Map(seedData.ranking.map((r) => [r.nome, r]))
  const bolaoRef = db.collection('boloes').doc(bolaoId)

  console.log(`Gravando boloes/${bolaoId}…`)
  await bolaoRef.set({
    nome: seedData.bolao.nome,
    competicao: seedData.bolao.competicao,
    criadoPor: 'seed',
    criadoEm: new Date().toISOString(),
    acesso: 'convite',
    regras: seedData.bolao.regras ?? {},
  })

  console.log(`Gravando ${seedData.partidas.length} partidas…`)
  const batch1 = db.batch()
  for (const partida of seedData.partidas) {
    const { id, ...data } = partida
    batch1.set(bolaoRef.collection('partidas').doc(id), data)
  }
  await batch1.commit()

  console.log(`Gravando ${seedData.participantes.length} participantes…`)
  const batch2 = db.batch()
  for (const p of seedData.participantes) {
    const slug = slugify(p.nome)
    const stats = rankingMap.get(p.nome)
    const email = (emails[p.nome]?.trim() ?? '').toLowerCase()

    batch2.set(bolaoRef.collection('participantes').doc(slug), {
      nome: p.nome,
      email,
      total_pontos: stats?.total_pontos ?? 0,
      na_mosca: stats?.na_mosca ?? 0,
      acerto_resultado: stats?.acerto_resultado ?? 0,
      sem_aposta: stats?.sem_aposta ?? 0,
      posicao: stats?.posicao ?? 99,
      papel: 'membro',
      entrouEm: new Date().toISOString(),
    })
  }
  await batch2.commit()

  console.log('Gravando palpites…')
  let count = 0
  const batch3 = db.batch()
  for (const [nome, palpites] of Object.entries(seedData.palpites)) {
    const slug = slugify(nome)
    for (const palpite of palpites) {
      const id = `${slug}_${palpite.partida_id}`
      batch3.set(bolaoRef.collection('palpites').doc(id), {
        participante_id: slug,
        partida_id: palpite.partida_id,
        palpite_casa: palpite.palpite_casa,
        palpite_fora: palpite.palpite_fora,
        pontos: palpite.pontos,
      })
      count++
    }
  }
  await batch3.commit()

  console.log('Criando usuários no Firebase Auth…')
  await seedAuthUsers(emails)

  console.log(`✅ Seed concluído em boloes/${bolaoId}: ${count} palpites gravados.`)
}

async function seedAuthUsers(emails: Record<string, string>) {
  const authAdmin = getAuth()
  const uniqueEmails = [
    ...new Set(
      Object.values(emails)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]

  for (const email of uniqueEmails) {
    try {
      await authAdmin.createUser({ email, emailVerified: true })
      console.log(`  ✓ Auth criado: ${email}`)
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      if (code === 'auth/email-already-exists') {
        console.log(`  · Auth já existe: ${email}`)
      } else {
        console.warn(`  ! Erro ao criar Auth ${email}:`, err)
      }
    }
  }
}

seed().catch((err) => {
  if (
    err instanceof Error &&
    err.message.includes('Could not load the default credentials')
  ) {
    printCredentialHelp()
    process.exit(1)
  }

  const details = err instanceof Error ? err.message : String(err)
  if (details.includes('SERVICE_DISABLED') || details.includes('has not been used in project')) {
    console.error(`
❌ Firestore ainda não está ativo no projeto bombolao-9ea22.

Ative em 2 passos:

1. Abra o Firebase Console:
   https://console.firebase.google.com/project/bombolao-9ea22/firestore

2. Clique em "Criar banco de dados"
   - Modo: Produção (as regras do projeto já estão configuradas)
   - Região: southamerica-east1 (São Paulo) — recomendado para o Brasil

3. Aguarde 1–2 minutos e rode novamente:
   npm run seed

Se preferir habilitar só a API manualmente:
   https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=bombolao-9ea22
`)
    process.exit(1)
  }

  console.error('Erro no seed:', err)
  process.exit(1)
})
