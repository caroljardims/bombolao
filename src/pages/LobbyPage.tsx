import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LoadingState } from '../components/LoadingState'
import { Icon } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useMembrosias } from '../hooks/useMembrosias'
import { normalizeInviteCode } from '../lib/inviteCode'
import { leaveBolao } from '../lib/joinBolao'
import { bolaoPath } from '../lib/paths'
import type { Membrosia } from '../lib/types'

export function LobbyPage() {
  const { user, loading: authLoading } = useAuth()
  const { membrosias, loading: membrosiasLoading } = useMembrosias()
  const navigate = useNavigate()
  const [inviteInput, setInviteInput] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<Membrosia | null>(null)
  const [leaving, setLeaving] = useState(false)

  async function handleLeave(m: Membrosia) {
    if (!user) return
    setLeaving(true)
    try {
      await leaveBolao(m.bolaoId, user.uid, user.email)
      toast.success(`Você saiu de ${m.nome}.`)
      setConfirmFor(null)
    } catch {
      toast.error('Não foi possível sair do bolão. Tente novamente.')
    } finally {
      setLeaving(false)
    }
  }

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
              <div key={m.bolaoId} className="lobby-card-wrap">
                <Link to={bolaoPath(m.bolaoId)} className="card lobby-card joined">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="lobby-card-title">{m.nome}</p>
                      <p className="lobby-card-sub">{m.papel === 'admin' ? 'Administrador' : 'Membro'}</p>
                    </div>
                    <span className="lobby-card-arrow"><Icon.arrow s={18} /></span>
                  </div>
                </Link>
                <button
                  type="button"
                  className="lobby-card-menu-btn"
                  aria-label="Opções do bolão"
                  onClick={() => setMenuFor((cur) => (cur === m.bolaoId ? null : m.bolaoId))}
                >
                  <Icon.dots s={18} />
                </button>
                {menuFor === m.bolaoId && (
                  <div className="lobby-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="lobby-menu-item danger"
                      onClick={() => {
                        setMenuFor(null)
                        setConfirmFor(m)
                      }}
                    >
                      <Icon.exit s={16} />
                      Sair do bolão
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {menuFor && (
        <div className="lobby-menu-backdrop" role="presentation" onClick={() => setMenuFor(null)} />
      )}

      {confirmFor && (
        <div
          className="chave-modal-overlay"
          role="presentation"
          onClick={() => !leaving && setConfirmFor(null)}
        >
          <div
            className="chave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="leave-title">Sair de {confirmFor.nome}?</h3>
            <p className="sub">
              Esta ação é <strong>definitiva</strong>: você perde seus palpites e sua pontuação neste
              bolão. Para voltar, vai precisar de um novo convite.
            </p>
            <div className="chave-modal-actions">
              <button
                type="button"
                className="btn btn-ghost-gold"
                onClick={() => setConfirmFor(null)}
                disabled={leaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleLeave(confirmFor)}
                disabled={leaving}
              >
                {leaving ? 'Saindo…' : 'Sair do bolão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
