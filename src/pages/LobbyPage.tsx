import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
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
      <div className="space-y-8 pt-8 text-center">
        <div>
          <div className="text-6xl">⚽</div>
          <h2 className="mt-4 text-2xl font-bold">Bombolão</h2>
          <p className="mt-2 text-sm text-white/60">
            Crie bolões com amigos, faça palpites e acompanhe o ranking em tempo real.
          </p>
        </div>
        <Link
          to="/conta"
          className="inline-block w-full max-w-xs rounded-xl bg-grass-light py-4 text-base font-semibold"
        >
          Entrar ou criar conta
        </Link>
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Olá, {user.displayName?.split(' ')[0] ?? 'jogador'}!</h2>
        <p className="text-sm text-white/50">Seus bolões</p>
      </div>

      <div className="flex gap-3">
        <Link
          to="/criar"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-sm font-semibold text-pitch"
        >
          <span>+</span> Criar bolão
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-pitch-card p-4">
        <p className="mb-2 text-sm font-medium">Entrar com convite</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
            placeholder="Código"
            className="input-field flex-1 uppercase tracking-widest"
          />
          <button
            type="button"
            onClick={handleJoinCode}
            className="rounded-xl bg-grass-light px-4 font-semibold"
          >
            Entrar
          </button>
        </div>
      </div>

      {membrosiasLoading ? (
        <LoadingState />
      ) : membrosias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center">
          <p className="text-white/50">Você ainda não está em nenhum bolão.</p>
          <p className="mt-1 text-sm text-white/30">
            Crie um novo ou peça um código de convite.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {membrosias.map((m) => (
            <Link
              key={m.bolaoId}
              to={bolaoPath(m.bolaoId)}
              className="group block rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/20 via-gold/10 to-pitch-card p-4 shadow-lg shadow-gold/10 transition active:scale-[0.98] hover:border-gold hover:from-gold/25"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gold">{m.nome}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {m.papel === 'admin' ? 'Administrador' : 'Membro'}
                  </p>
                </div>
                <span className="shrink-0 text-lg text-gold/80 transition group-hover:translate-x-0.5 group-hover:text-gold">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Carregando…
    </div>
  )
}
