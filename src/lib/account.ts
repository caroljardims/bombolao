import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth'
import { getDocs } from 'firebase/firestore'
import { auth, googleProvider } from './firebase'
import { leaveBolao } from './joinBolao'
import { membrosiasRef } from './paths'
import { deleteStoredAvatars } from './profile'

export class AccountError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AccountError'
    this.code = code
  }
}

/** True quando a conta usa e-mail/senha (precisamos da senha para reautenticar). */
export function isPasswordUser(): boolean {
  const u = auth.currentUser
  return !!u?.providerData.some((p) => p.providerId === 'password')
}

async function reauthenticate(password?: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AccountError('Faça login novamente.')
  const providers = user.providerData.map((p) => p.providerId)

  if (providers.includes('google.com')) {
    await reauthenticateWithPopup(user, googleProvider)
    return
  }
  if (providers.includes('password')) {
    if (!password) throw new AccountError('Digite sua senha para confirmar.', 'password-required')
    if (!user.email) throw new AccountError('Conta sem e-mail para reautenticar.')
    const cred = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, cred)
    return
  }
  throw new AccountError('Não foi possível reautenticar esta conta.')
}

/**
 * Exclui a conta do usuário de forma definitiva:
 * 1. reautentica (popup Google ou senha) — exigência do Firebase para excluir;
 * 2. sai de todos os bolões (apaga participante, palpites, cravada e membrosia);
 * 3. remove os avatares do Storage;
 * 4. exclui a conta do Firebase Auth.
 *
 * A reautenticação vem primeiro para não apagar os dados e falhar no fim.
 */
export async function deleteAccount(opts?: { password?: string }): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AccountError('Faça login novamente.')

  await reauthenticate(opts?.password)

  const snap = await getDocs(membrosiasRef(user.uid))
  for (const d of snap.docs) {
    await leaveBolao(d.id, user.uid, user.email)
  }

  try {
    await deleteStoredAvatars(user.uid)
  } catch {
    /* best-effort */
  }

  await deleteUser(user)
}
