import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LoadingState } from '../components/LoadingState'
import { useAuth } from '../hooks/useAuth'
import { getBolao, getConvite, joinBolaoByInvite } from '../lib/joinBolao'
import { bolaoPath } from '../lib/paths'

export function ConvitePage() {
  const { code = '' } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [bolaoNome, setBolaoNome] = useState('')
  const [busy, setBusy] = useState(false)
  const [validating, setValidating] = useState(true)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    async function validate() {
      const convite = await getConvite(code)
      if (!convite || !convite.ativo) {
        setInvalid(true)
        setValidating(false)
        return
      }
      const bolao = await getBolao(convite.bolaoId)
      setBolaoNome(bolao?.nome ?? 'Bolão')
      setValidating(false)
    }
    validate().catch(() => {
      setInvalid(true)
      setValidating(false)
    })
  }, [code])

  useEffect(() => {
    if (user?.displayName) setNomeExibicao(user.displayName)
  }, [user])

  if (authLoading || validating) return <LoadingState message="Verificando convite…" />

  if (invalid) {
    return (
      <div className="screen" style={{ paddingTop: 24, textAlign: 'center' }}>
        <div className="alert-error">
          <p>Convite inválido ou expirado.</p>
          <Link to="/" className="link-gold center-link">
            ← Voltar ao lobby
          </Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="screen" style={{ paddingTop: 24, textAlign: 'center' }}>
        <p className="sub">Você foi convidado para</p>
        <h2 className="gold-text" style={{ fontSize: 27, fontWeight: 800, marginTop: 8 }}>
          {bolaoNome}
        </h2>
        <p className="sub" style={{ marginTop: 12 }}>
          Faça login para entrar no bolão.
        </p>
        <Link
          to="/conta"
          state={{ returnTo: `/convite/${code}` }}
          className="btn btn-gold full"
          style={{ marginTop: 20, maxWidth: 360, marginInline: 'auto', display: 'flex' }}
        >
          Entrar
        </Link>
      </div>
    )
  }

  async function handleJoin() {
    if (!user) return
    if (!nomeExibicao.trim()) {
      toast.error('Informe como quer aparecer no ranking.')
      return
    }
    setBusy(true)
    try {
      const bolaoId = await joinBolaoByInvite(code, user.uid, user.email ?? '', nomeExibicao, user.photoURL)
      toast.success(`Bem-vindo ao ${bolaoNome}!`)
      navigate(bolaoPath(bolaoId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen" style={{ maxWidth: 440, margin: '0 auto', paddingTop: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <p className="sub">Convite para</p>
        <h2 className="gold-text" style={{ fontSize: 27, fontWeight: 800, marginTop: 8 }}>
          {bolaoNome}
        </h2>
      </div>

      <div className="card conta-card" style={{ marginTop: 20 }}>
        <label className="field">
          <span className="field-label">Seu nome no bolão</span>
          <input
            value={nomeExibicao}
            onChange={(e) => setNomeExibicao(e.target.value)}
            placeholder="Como aparecer no ranking"
            className="input"
          />
        </label>
        <button type="button" onClick={handleJoin} disabled={busy} className="btn btn-gold full" style={{ marginTop: 16 }}>
          {busy ? 'Entrando…' : 'Entrar no bolão'}
        </button>
      </div>

      <Link to="/" className="link-muted center-link">
        ← Voltar ao lobby
      </Link>
    </div>
  )
}
