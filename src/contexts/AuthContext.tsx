import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'

/** Snapshot plano — nova referência a cada refresh para o React detectar mudanças no perfil. */
export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refreshUser: async () => {},
})

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const refreshUser = useCallback(async () => {
    const current = auth.currentUser
    if (!current) {
      setUser(null)
      return
    }
    await current.reload()
    const refreshed = auth.currentUser
    setUser(refreshed ? toAuthUser(refreshed) : null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
