import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Layout() {
  const { user } = useAuth()

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-lead">
            <span className="brand-mini">BOMBOLÃO</span>
            <h1 className="header-title">Seus bolões</h1>
          </div>
          {user?.photoURL ? (
            <NavLink to="/conta">
              <img className="header-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            </NavLink>
          ) : user ? (
            <NavLink to="/conta">
              <span className="header-avatar-mono">
                {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
              </span>
            </NavLink>
          ) : (
            <NavLink to="/conta" className="btn btn-ghost-gold" style={{ padding: '9px 14px' }}>
              Entrar
            </NavLink>
          )}
        </div>
      </header>

      <main className="app-scroll">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
