import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="EasyLook, ir a la tienda">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 6a3.4 3.4 0 0 1 3.4 3.4c0 1.4-.9 2.3-2.2 2.9V14l9.8 7c1 .7.5 2.2-.7 2.2H5.7c-1.2 0-1.7-1.5-.7-2.2l9.8-7v-2" />
          </svg>
          EasyLook
        </Link>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end>
            Tienda
          </NavLink>
          <NavLink to="/look-match">Look Match</NavLink>
          <NavLink to="/outfits">Mis outfits</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Catálogo</NavLink>}
        </nav>
        <div className="session">
          {user ? (
            <>
              <span className="session-name">{user.name}</span>
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link to="/ingresar" className="button button--quiet">
              Ingresar
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>Catálogo ficticio para un proyecto académico. No hay compras, pagos ni envíos.</p>
        <a href={`${import.meta.env.VITE_API_URL ?? ''}/docs`} target="_blank" rel="noreferrer">
          Documentación de la API
        </a>
      </footer>
    </div>
  )
}
