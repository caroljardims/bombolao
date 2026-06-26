/**
 * Cria (ou atualiza) um usuário de teste no Firebase Auth com e-mail/senha,
 * para login direto em dev — sem depender de reset de senha / domínios autorizados.
 * Opcionalmente adiciona o usuário como participante + membrosia de um bolão.
 *
 * Uso:
 *   npm run create-test-user -- [email] [senha] [bolaoId] [nome]
 *
 * Padrões:
 *   email   = teste@bombolao.dev
 *   senha   = teste1234
 *   bolaoId = (nenhum)   — só vincula se você passar um bolaoId explícito
 *   nome    = derivado do e-mail
 *
 * IMPORTANTE: por segurança, NUNCA vincula a um bolão por padrão. Para evitar
 * acidentes em produção, o bolão "colorados-do-inter" é bloqueado aqui.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

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
  if (getApps().length > 0) return { db: getFirestore(), auth: getAuth() }
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Service account não encontrada na raiz do projeto')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return { db: getFirestore(), auth: getAuth() }
}

async function main() {
  const email = (process.argv[2] || 'teste@bombolao.dev').trim().toLowerCase()
  const senha = process.argv[3] || 'teste1234'
  const bolaoArg = process.argv[4] ?? ''
  const bolaoId = bolaoArg === '-' ? '' : bolaoArg
  const nome = process.argv[5] || email.split('@')[0]

  if (senha.length < 6) {
    console.error('A senha precisa ter ao menos 6 caracteres (regra do Firebase Auth).')
    process.exit(1)
  }

  // Trava de segurança: nunca jogar conta de teste no bolão real de produção.
  const BLOQUEADOS = new Set(['colorados-do-inter'])
  if (BLOQUEADOS.has(bolaoId)) {
    console.error(
      `\n⛔ Recusando vincular conta de teste ao bolão de produção "${bolaoId}".\n` +
        `   Crie/use um bolão de teste separado, ou rode sem bolão (conta só no Auth).\n`,
    )
    process.exit(1)
  }

  const { db, auth } = initAdmin()

  // 1) Cria ou atualiza a conta no Firebase Auth
  let uid: string
  try {
    const existing = await auth.getUserByEmail(email)
    uid = existing.uid
    await auth.updateUser(uid, { password: senha, emailVerified: true, displayName: nome })
    console.log(`· conta existente atualizada (uid ${uid})`)
  } catch {
    const created = await auth.createUser({
      email,
      password: senha,
      emailVerified: true,
      displayName: nome,
    })
    uid = created.uid
    console.log(`· conta criada (uid ${uid})`)
  }

  // 2) Opcional: vincula a um bolão (participante + membrosia)
  if (bolaoId) {
    const bolaoRef = db.collection('boloes').doc(bolaoId)
    const bolaoSnap = await bolaoRef.get()
    if (!bolaoSnap.exists) {
      console.warn(`! bolão "${bolaoId}" não encontrado — pulei a vinculação`)
    } else {
      await bolaoRef.collection('participantes').doc(uid).set(
        {
          nome,
          email,
          total_pontos: 0,
          na_mosca: 0,
          acerto_resultado: 0,
          sem_aposta: 0,
          posicao: 99,
          papel: 'membro',
          entrouEm: new Date().toISOString(),
        },
        { merge: true },
      )
      await db.collection('users').doc(uid).collection('membrosias').doc(bolaoId).set(
        {
          bolaoId,
          nome: bolaoSnap.data()?.nome ?? bolaoId,
          papel: 'membro',
          entrouEm: new Date().toISOString(),
        },
        { merge: true },
      )
      console.log(`· vinculado ao bolão ${bolaoId} (participante + membrosia)`)
    }
  }

  console.log('\n✅ Usuário de teste pronto. Faça login em dev com:')
  console.log(`   e-mail: ${email}`)
  console.log(`   senha:  ${senha}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
