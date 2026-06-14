import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from './firebase'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase()
  const result = await signInWithEmailAndPassword(auth, normalized, password)
  return result.user
}

export async function sendPasswordSetupEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    throw new AuthError('Informe seu e-mail.')
  }

  await sendPasswordResetEmail(auth, normalized, {
    url: `${window.location.origin}/conta`,
    handleCodeInApp: false,
  })
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}
