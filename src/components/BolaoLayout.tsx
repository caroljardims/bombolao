import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { LoadingState } from './LoadingState'
import { Icon, type IconName } from './ui'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'

const NAV: { to: string; label: string; icon: IconName; end?: boolean; adminOnly?: boolean }[] = [
  { to: '', label: 'Ranking', icon: 'trophy', end: true },
  { to: 'partidas', label: 'Jogos', icon: 'ball' },
  { to: 'palpites', label: 'Palpites', icon: 'pencil', end: true },
  { to: 'admin', label: 'Admin', icon: 'gear', adminOnly: true },
  { to: '/conta', label: 'Conta', icon: 'user' },
]

export function BolaoLayout() {
  const { user, loading: authLoading } = useAuth()
  const { bolao, loading, error, isAdmin, isMember, membershipReady } = useBolao()
  const { bolaoId = '' } = useParams<{ bolaoId: string }>()
  const location = useLocation()

  if (authLoading) {
    return (
      <div className="app">
        <LoadingState message="Verificando sessão…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/conta" replace state={{ returnTo: location.pathname }} />
  }

  if (loading) {
    return (
      <div className="app">
        <LoadingState message="Carregando bolão…" />
      </div>
    )
  }

  if (error || !bolao) {
    return (
      <div className="app">
        <main className="app-scroll">
          <div className="page" style={{ paddingTop: 24 }}>
            <div className="alert-error">
              <p>{error ?? 'Bolão não encontrado.'}</p>
              <NavLink to="/" className="link-gold" style={{ marginTop: 12 }}>
                ← Voltar ao lobby
              </NavLink>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (membershipReady && !isMember) {
    return (
      <div className="app">
        <main className="app-scroll">
          <div className="page" style={{ paddingTop: 24 }}>
            <div className="alert-gold" style={{ textAlign: 'center' }}>
              <p>Você precisa entrar neste bolão para ver ranking, jogos e palpites.</p>
              <Link to="/" className="link-gold center-link" style={{ marginTop: 12 }}>
                ← Voltar ao lobby
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const base = bolaoPath(bolaoId)
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-lead">
            <NavLink to="/" className="lobby-link">
              <Icon.back s={15} /> Lobby
            </NavLink>
            <h1 className="header-title">{bolao.nome}</h1>
            <p className="header-sub">{bolao.competicao}</p>
          </div>
          {user?.photoURL ? (
            <img className="header-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="header-avatar-mono">
              {(user?.displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </span>
          )}
        </div>
      </header>

      <main className="app-scroll">
        <div className="page">
          <Outlet />
        </div>
        <div className="nav-spacer" />
      </main>

      <nav className="bottom-nav">
        <div className="nav-inner">
          {navItems.map((item) => {
            const I = Icon[item.icon]
            const isExternal = item.to.startsWith('/')
            const path = isExternal ? item.to : `${base}${item.to ? `/${item.to}` : ''}`

            return (
              <NavLink
                key={item.label}
                to={path}
                end={item.end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">
                  <I s={22} w={2} />
                </span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
