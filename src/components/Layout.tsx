import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Layout() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-grass/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gold">Bombolão</p>
            <h1 className="text-lg font-bold leading-tight">Seus bolões</h1>
          </div>
          {user?.photoURL ? (
            <NavLink to="/conta">
              <img
                src={user.photoURL}
                alt=""
                className="h-9 w-9 rounded-full border border-gold/40"
              />
            </NavLink>
          ) : (
            <NavLink
              to="/conta"
              className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold"
            >
              Entrar
            </NavLink>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
