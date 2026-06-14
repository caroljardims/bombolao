/**
 * Migra dados do modelo single-tenant (coleções root) para boloes/colorados-do-inter.
 * Idempotente: pula docs que já existem no destino.
 *
 * Uso: npm run migrate
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { DEFAULT_REGRAS } from '../src/lib/regras'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'
const BOLAO_ID = 'colorados-do-inter'

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const candidates = [join(root, 'service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      candidates.push(join(root, file))
    }
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

function initAdmin(): Firestore {
  if (getApps().length > 0) return getFirestore()
  const credPath = findServiceAccountPath()
  if (credPath) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))),
      projectId: PROJECT_ID,
    })
  } else {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  }
  return getFirestore()
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function migrate() {
  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(BOLAO_ID)

  console.log(`\n🔄 Migrando para boloes/${BOLAO_ID}…\n`)

  const bolaoSnap = await bolaoRef.get()
  if (!bolaoSnap.exists) {
    const configSnap = await db.collection('bolao').doc('config').get()
    const config = configSnap.data() ?? {
      nome: 'Colorados do Inter',
      competicao: 'Copa do Mundo 2026',
    }

    await bolaoRef.set({
      nome: config.nome,
      competicao: config.competicao,
      criadoPor: 'migration',
      criadoEm: new Date().toISOString(),
      acesso: 'convite',
      regras: DEFAULT_REGRAS,
    })
    console.log('✓ Doc bolão criado')
  } else {
    console.log('· Doc bolão já existe — pulando')
  }

  const partidasSnap = await db.collection('partidas').get()
  let partidasCopied = 0
  const batch1 = db.batch()
  for (const doc of partidasSnap.docs) {
    const dest = bolaoRef.collection('partidas').doc(doc.id)
    if (!(await dest.get()).exists) {
      batch1.set(dest, doc.data())
      partidasCopied++
    }
  }
  if (partidasCopied > 0) await batch1.commit()
  console.log(`✓ Partidas: ${partidasCopied} copiadas (${partidasSnap.size} no root)`)

  const participantesSnap = await db.collection('participantes').get()
  let participantesCopied = 0
  let membrosiasCreated = 0
  const batch2 = db.batch()
  const now = new Date().toISOString()

  for (const doc of participantesSnap.docs) {
    const data = doc.data()
    const dest = bolaoRef.collection('participantes').doc(doc.id)
    if (!(await dest.get()).exists) {
      const papel = data.linked ? 'membro' : 'membro'
      batch2.set(dest, {
        nome: data.nome,
        email: data.email ?? '',
        total_pontos: data.total_pontos ?? 0,
        na_mosca: data.na_mosca ?? 0,
        acerto_resultado: data.acerto_resultado ?? 0,
        sem_aposta: data.sem_aposta ?? 0,
        posicao: data.posicao ?? 99,
        papel: doc.id.length >= 20 ? papel : 'membro',
        entrouEm: now,
      })
      participantesCopied++
    }

    if (doc.id.length >= 20 && data.linked) {
      const membrosiaRef = db.collection('users').doc(doc.id).collection('membrosias').doc(BOLAO_ID)
      if (!(await membrosiaRef.get()).exists) {
        batch2.set(membrosiaRef, {
          bolaoId: BOLAO_ID,
          nome: (await bolaoRef.get()).data()?.nome ?? 'Colorados do Inter',
          papel: 'membro',
          entrouEm: now,
        })
        membrosiasCreated++
      }
    }
  }
  if (participantesCopied > 0 || membrosiasCreated > 0) await batch2.commit()
  console.log(`✓ Participantes: ${participantesCopied} copiados`)
  console.log(`✓ Membrosias: ${membrosiasCreated} criadas`)

  const palpitesSnap = await db.collection('palpites').get()
  let palpitesCopied = 0
  const batch3 = db.batch()
  for (const doc of palpitesSnap.docs) {
    const dest = bolaoRef.collection('palpites').doc(doc.id)
    if (!(await dest.get()).exists) {
      batch3.set(dest, doc.data())
      palpitesCopied++
    }
  }
  if (palpitesCopied > 0) await batch3.commit()
  console.log(`✓ Palpites: ${palpitesCopied} copiados (${palpitesSnap.size} no root)`)

  const convitesSnap = await db.collection('convites').where('bolaoId', '==', BOLAO_ID).limit(1).get()
  if (convitesSnap.empty) {
    const code = generateInviteCode()
    await db.collection('convites').doc(code).set({
      bolaoId: BOLAO_ID,
      criadoPor: 'migration',
      ativo: true,
      maxUsos: 100,
      usos: 0,
      expiraEm: null,
    })
    console.log(`✓ Convite criado: ${code}`)
    console.log(`  Link: https://bombolao-9ea22.web.app/convite/${code}`)
  } else {
    console.log(`· Convite já existe: ${convitesSnap.docs[0].id}`)
  }

  console.log(`
✅ Migração concluída!

Próximos passos:
1. Deploy app + rules: npm run deploy
2. Acesse: /b/${BOLAO_ID}
3. Após validar, rode: npm run migrate:cleanup (remove coleções root)
`)
}

migrate().catch((err) => {
  console.error('Erro na migração:', err)
  process.exit(1)
})
