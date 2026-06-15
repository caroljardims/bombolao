import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LoadingState } from '../components/LoadingState'
import { Icon } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useMembrosias } from '../hooks/useMembrosias'
import { normalizeInviteCode } from '../lib/inviteCode'
import { bolaoPath } from '../lib/paths'

export function LobbyPage() {
  const { user, loading: authLoading } = useAuth()
  const { membrosias, loading: membrosiasLoading } = useMembrosias()
  const navigate = useNavigate()
  const [inviteInput, setInviteInput] = useState('')

  if (authLoading) return <LoadingState />

  if (!user) {
    return (
      <div className="screen lobby-screen">
        <div className="page-narrow">
          <div className="login-hero">
            <div className="login-hero-icon">⚽</div>
            <h2 style={{ marginTop: 16, fontSize: 27, fontWeight: 800 }}>Bombolão</h2>
            <p className="sub" style={{ marginTop: 8 }}>
              Crie bolões com amigos, faça palpites e acompanhe o ranking em tempo real.
            </p>
          </div>
          <Link to="/conta" className="btn btn-gold full" style={{ marginTop: 24 }}>
            Entrar ou criar conta
          </Link>
        </div>
      </div>
    )
  }

  function handleJoinCode() {
    const code = normalizeInviteCode(inviteInput)
    if (!code) {
      toast.error('Informe um código de convite.')
      return
    }
    navigate(`/convite/${code}`)
  }

  return (
    <div className="screen lobby-screen">
      <div className="page-narrow">
        <header className="section-head plain">
          <div>
            <h2>Olá, {user.displayName?.split(' ')[0] ?? 'jogador'}!</h2>
            <p className="sub">Seus bolões</p>
          </div>
        </header>

        <Link to="/criar" className="btn btn-gold full" style={{ marginBottom: 16 }}>
          + Criar bolão
        </Link>

        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ fontWeight: 700, marginBottom: 10 }}>Entrar com convite</p>
          <div className="invite-row">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              placeholder="Código"
              className="input"
            />
            <button type="button" onClick={handleJoinCode} className="btn btn-save">
              Entrar
            </button>
          </div>
        </div>

        {membrosiasLoading ? (
          <LoadingState message="Carregando bolões…" />
        ) : membrosias.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 20 }}>
            <p>Você ainda não está em nenhum bolão.</p>
            <p>Crie um novo ou peça um código de convite.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {membrosias.map((m) => (
              <Link key={m.bolaoId} to={bolaoPath(m.bolaoId)} className="card lobby-card joined">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="lobby-card-title">{m.nome}</p>
                    <p className="lobby-card-sub">{m.papel === 'admin' ? 'Administrador' : 'Membro'}</p>
                  </div>
                  <Icon.arrow s={18} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
