import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { AdminPage } from './pages/AdminPage'
import { CatalogPage } from './pages/CatalogPage'
import { LoginPage } from './pages/LoginPage'
import { LookMatchPage } from './pages/LookMatchPage'
import { OutfitPage } from './pages/OutfitPage'
import { OutfitsPage } from './pages/OutfitsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="page">Cargando tu sesión…</p>
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="look-match" element={<LookMatchPage />} />
        <Route path="ingresar" element={<LoginPage />} />
        <Route
          path="outfits"
          element={
            <RequireAuth>
              <OutfitsPage />
            </RequireAuth>
          }
        />
        <Route
          path="outfits/:outfitId"
          element={
            <RequireAuth>
              <OutfitPage />
            </RequireAuth>
          }
        />
        <Route path="admin" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <div className="page">
              <h1 className="display">Esta página no existe</h1>
              <Link to="/">Volver a la tienda</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
