import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'

export function BolaoLayout() {
  const { user } = useAuth()
  const { bolao, loading, error, isAdmin } = useBolao()
  const { bolaoId = '' } = useParams<{ bolaoId: string }>()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        Carregando bolão…
      </div>
    )
  }

  if (error || !bolao) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-center">
        <p className="text-red-300">{error ?? 'Bolão não encontrado.'}</p>
        <NavLink to="/" className="mt-4 inline-block text-sm text-gold hover:underline">
          ← Voltar ao lobby
        </NavLink>
      </div>
    )
  }

  const base = bolaoPath(bolaoId)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-grass/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 lg:max-w-5xl">
          <div className="min-w-0">
            <NavLink to="/" className="text-xs font-medium uppercase tracking-wider text-gold hover:underline">
              ← Lobby
            </NavLink>
            <h1 className="truncate text-lg font-bold leading-tight">{bolao.nome}</h1>
            <p className="truncate text-xs text-white/50">{bolao.competicao}</p>
          </div>
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-gold/40"
            />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24 lg:max-w-5xl">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-pitch/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg lg:max-w-5xl">
          <NavItem to={base} end label="Ranking" icon="🏆" />
          <NavItem to={`${base}/partidas`} label="Jogos" icon="⚽" />
          <NavItem to={`${base}/palpites`} label="Palpites" icon="📝" />
          {isAdmin && <NavItem to={`${base}/admin`} label="Admin" icon="⚙️" />}
          <NavItem to="/conta" label="Conta" icon="👤" />
        </div>
      </nav>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string
  label: string
  icon: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition ${
          isActive ? 'text-gold' : 'text-white/50 hover:text-white/80'
        }`
      }
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}
