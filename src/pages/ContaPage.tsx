import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../hooks/useAuth'
import { useMembrosias } from '../hooks/useMembrosias'
import {
  signInWithGoogle,
  signInWithEmailPassword,
  sendPasswordSetupEmail,
  signOut,
  AuthError,
} from '../lib/auth'

type LoginMode = 'google' | 'email'

function getLoginErrorMessage(err: unknown): string {
  if (err instanceof AuthError) return err.message
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/unauthorized-domain':
        return 'Domínio não autorizado. Adicione este site nos domínios do Firebase Auth.'
      case 'auth/popup-closed-by-user':
        return 'Login cancelado.'
      case 'auth/popup-blocked':
        return 'Popup bloqueado pelo navegador. Permita popups para este site.'
      case 'auth/operation-not-allowed':
        return 'Este método de login não está habilitado no Firebase.'
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email':
        return 'E-mail ou senha incorretos.'
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos.'
      default:
        return `Erro (${err.code}): ${err.message}`
    }
  }
  if (err instanceof Error) return err.message
  return 'Erro ao fazer login'
}

export function ContaPage() {
  const { user, loading } = useAuth()
  const { membrosias } = useMembrosias()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/'
  const [mode, setMode] = useState<LoginMode>('google')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        Carregando…
      </div>
    )
  }

  async function handleGoogleSignIn() {
    setBusy(true)
    try {
      await signInWithGoogle()
      toast.success('Login realizado!')
    } catch (err) {
      toast.error(getLoginErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await signInWithEmailPassword(email, password)
      toast.success('Login realizado!')
    } catch (err) {
      toast.error(getLoginErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendPasswordEmail() {
    if (!email.trim()) {
      toast.error('Informe seu e-mail.')
      return
    }
    setBusy(true)
    try {
      await sendPasswordSetupEmail(email)
      toast.success('E-mail enviado! Verifique sua caixa de entrada (e spam).')
    } catch (err) {
      toast.error(getLoginErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
      toast.success('Logout realizado')
    } catch {
      toast.error('Erro ao sair')
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-4">
        <div>
          <h2 className="text-xl font-bold">Minha conta</h2>
          <p className="text-sm text-white/50">Gerencie seu acesso à plataforma</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-pitch-card p-5 text-center">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-gold/40"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/40 bg-grass-light/30 text-3xl">
              👤
            </div>
          )}
          <p className="text-xl font-bold">{user.displayName ?? 'Usuário'}</p>
          <p className="mt-1 text-sm text-white/50">{user.email}</p>
          <p className="mt-3 text-sm text-white/40">
            {membrosias.length} bolão{membrosias.length !== 1 ? 'ões' : ''}
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-gold hover:underline"
          >
            Ver meus bolões →
          </Link>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="w-full rounded-xl border border-red-400/30 bg-red-400/10 py-4 text-base font-semibold text-red-300 disabled:opacity-60"
        >
          {busy ? 'Saindo…' : 'Sair da conta'}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="text-center">
        <div className="text-6xl">⚽</div>
        <h2 className="mt-4 text-2xl font-bold">Entrar no Bombolão</h2>
        <p className="mt-2 text-sm text-white/60">
          Crie bolões, entre com convite e faça seus palpites.
        </p>
      </div>

      <div className="flex rounded-xl border border-white/10 bg-pitch-card p-1">
        <ModeButton active={mode === 'google'} onClick={() => setMode('google')}>
          Google
        </ModeButton>
        <ModeButton active={mode === 'email'} onClick={() => setMode('email')}>
          E-mail e senha
        </ModeButton>
      </div>

      {mode === 'google' ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-4 text-base font-semibold text-gray-800 disabled:opacity-60"
          >
            <GoogleIcon />
            {busy ? 'Entrando…' : 'Entrar com Google'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="input-field"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="input-field"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-grass-light py-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-center">
            <p className="text-sm font-medium text-gold">Primeiro acesso?</p>
            <button
              type="button"
              onClick={handleSendPasswordEmail}
              disabled={busy}
              className="mt-3 text-sm font-semibold text-gold underline-offset-2 hover:underline disabled:opacity-60"
            >
              Enviar e-mail para criar senha
            </button>
          </div>
        </form>
      )}

      <Link to={returnTo} className="block text-center text-sm text-white/50 hover:text-gold">
        ← Voltar
      </Link>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
        active ? 'bg-grass-light text-white' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
