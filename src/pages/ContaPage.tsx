import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FirebaseError } from 'firebase/app'
import { LoadingState } from '../components/LoadingState'
import { Icon } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useMembrosias } from '../hooks/useMembrosias'
import {
  signInWithGoogle,
  signInWithEmailPassword,
  sendPasswordSetupEmail,
  signOut,
  AuthError,
} from '../lib/auth'
import { ProfileError, updateUserProfile } from '../lib/profile'
import { AccountError, deleteAccount, isPasswordUser } from '../lib/account'

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
  const { user, loading, refreshUser } = useAuth()
  const { membrosias } = useMembrosias()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/'
  const [mode, setMode] = useState<LoginMode>('google')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setNome(user.displayName ?? '')
    setPhotoPreview(null)
    setPhotoFile(null)
    setRemovePhoto(false)
  }, [user?.uid])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  if (loading) return <LoadingState />

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
    setSigningOut(true)
    try {
      await signOut()
      toast.success('Logout realizado')
    } catch {
      toast.error('Erro ao sair')
    } finally {
      setSigningOut(false)
    }
  }

  async function handleDeleteAccount() {
    const needsPassword = isPasswordUser()
    if (needsPassword && !deletePassword.trim()) {
      toast.error('Digite sua senha para confirmar.')
      return
    }
    setDeleting(true)
    try {
      await deleteAccount({ password: deletePassword || undefined })
      toast.success('Conta excluída.')
      setConfirmDelete(false)
    } catch (err) {
      if (err instanceof AccountError && err.code === 'password-required') {
        toast.error('Digite sua senha para confirmar.')
      } else if (err instanceof FirebaseError && err.code === 'auth/wrong-password') {
        toast.error('Senha incorreta.')
      } else if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') {
        toast.error('Confirmação cancelada.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a conta.')
      }
    } finally {
      setDeleting(false)
      setDeletePassword('')
    }
  }

  function handlePhotoSelect(file: File | null) {
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setRemovePhoto(false)
    setPhotoPreview(URL.createObjectURL(file))
    setSaved(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const nomeTrim = nome.trim()
    const nomeMudou = nomeTrim !== (user?.displayName ?? '').trim()
    const fotoMudou = !!photoFile || removePhoto

    if (!nomeMudou && !fotoMudou) {
      toast.error('Nenhuma alteração para salvar.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateUserProfile({
        displayName: nomeMudou ? nomeTrim : undefined,
        photoFile: photoFile ?? undefined,
        removePhoto,
      })
      await refreshUser()
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoFile(null)
      setPhotoPreview(null)
      setRemovePhoto(false)
      if (updated.displayName !== undefined) setNome(updated.displayName)
      setSaved(true)
      toast.success('Perfil atualizado!')
    } catch (err) {
      toast.error(err instanceof ProfileError ? err.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  if (user) {
    const avatarSrc = removePhoto ? null : (photoPreview ?? user.photoURL)
    const profileDirty =
      nome.trim() !== (user.displayName ?? '').trim() || !!photoFile || removePhoto
    const formLocked = saving || signingOut

    return (
      <div className="screen conta-screen">
        <header className="section-head plain center">
          <div>
            <h2>Minha conta</h2>
            <p className="sub">Edite seu nome e foto de perfil</p>
          </div>
        </header>

        <Link to="/" className="btn btn-gold full wide-out conta-cta">
          <Icon.trophy s={18} w={2} />
          Ver meus bolões
          <Icon.arrow s={16} />
        </Link>

        <form onSubmit={handleSaveProfile} className="conta-card card">
          <div className="conta-avatar">
            <button
              type="button"
              className="conta-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={formLocked}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="conta-photo" referrerPolicy="no-referrer" />
              ) : (
                <span className="conta-photo-placeholder">👤</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              style={{ display: 'none' }}
              onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
            />
            <div className="conta-photo-actions">
              <button
                type="button"
                className="link-gold"
                onClick={() => fileInputRef.current?.click()}
                disabled={formLocked}
              >
                Escolher foto
              </button>
              {user.photoURL && !removePhoto && !photoFile && (
                <button
                  type="button"
                  className="link-muted"
                  onClick={() => {
                    if (photoPreview) URL.revokeObjectURL(photoPreview)
                    setRemovePhoto(true)
                    setPhotoFile(null)
                    setPhotoPreview(null)
                    setSaved(false)
                  }}
                  disabled={formLocked}
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <label className="field">
            <span className="field-label">Nome de exibição</span>
            <input
              className="input"
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setSaved(false)
              }}
              maxLength={40}
              placeholder="Seu nome"
            />
            <span className="field-hint">Também aparece no ranking dos bolões em que você participa.</span>
          </label>

          <div className="conta-meta">
            <span>{user.email}</span>
            <span className="dotsep">·</span>
            <span>
              {membrosias.length} {membrosias.length === 1 ? 'bolão' : 'bolões'}
            </span>
          </div>

          <button
            type="submit"
            disabled={formLocked || !profileDirty || !nome.trim()}
            className={`btn btn-save full${saved ? ' done' : ''}`}
          >
            {saved ? (
              <>
                <Icon.check s={16} /> Alterações salvas
              </>
            ) : saving ? (
              'Salvando…'
            ) : (
              'Salvar alterações'
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={formLocked}
          className="btn btn-danger full wide-out"
        >
          {signingOut ? 'Saindo…' : 'Sair da conta'}
        </button>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={formLocked || deleting}
          className="link-danger center-link wide-out"
        >
          Excluir minha conta
        </button>

        {confirmDelete && (
          <div
            className="chave-modal-overlay"
            role="presentation"
            onClick={() => !deleting && setConfirmDelete(false)}
          >
            <div
              className="chave-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-account-title">Excluir sua conta?</h3>
              <p className="sub">
                Esta ação é <strong>definitiva</strong>. Você sai de todos os bolões e perde seus
                palpites, cravadas e pontuação. Não dá para desfazer.
              </p>
              {isPasswordUser() ? (
                <input
                  type="password"
                  autoComplete="current-password"
                  className="input"
                  style={{ marginTop: 12 }}
                  placeholder="Digite sua senha para confirmar"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  disabled={deleting}
                />
              ) : (
                <p className="sub" style={{ marginTop: 8, fontSize: 13 }}>
                  Você confirmará sua identidade pelo Google na próxima etapa.
                </p>
              )}
              <div className="chave-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost-gold"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Excluindo…' : 'Excluir conta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="screen conta-screen">
      <div className="page-narrow">
        <div className="login-hero">
          <div className="login-hero-icon">⚽</div>
          <h2 style={{ marginTop: 16, fontSize: 27, fontWeight: 800 }}>Entrar no Bombolão</h2>
          <p className="sub" style={{ marginTop: 8 }}>
            Crie bolões, entre com convite e faça seus palpites.
          </p>
        </div>

        <div className="mode-tabs" style={{ marginTop: 24 }}>
          <ModeButton active={mode === 'google'} onClick={() => setMode('google')}>
            Google
          </ModeButton>
          <ModeButton active={mode === 'email'} onClick={() => setMode('email')}>
            E-mail e senha
          </ModeButton>
        </div>

        <div style={{ marginTop: 20 }}>
          {mode === 'google' ? (
            <button type="button" onClick={handleGoogleSignIn} disabled={busy} className="btn-google">
              <GoogleIcon />
              {busy ? 'Entrando…' : 'Entrar com Google'}
            </button>
          ) : (
            <form onSubmit={handleEmailSignIn} className="form-stack">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="input"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className="input"
              />
              <button type="submit" disabled={busy} className="btn btn-save full">
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
              <div className="alert-gold" style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700 }}>Primeiro acesso?</p>
                <button
                  type="button"
                  onClick={handleSendPasswordEmail}
                  disabled={busy}
                  className="link-gold"
                  style={{ marginTop: 12 }}
                >
                  Enviar e-mail para criar senha
                </button>
              </div>
            </form>
          )}
        </div>

        <Link to={returnTo} className="link-muted center-link" style={{ marginTop: 20 }}>
          ← Voltar
        </Link>
      </div>
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
    <button type="button" onClick={onClick} className={`mode-tab${active ? ' active' : ''}`}>
      {children}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
