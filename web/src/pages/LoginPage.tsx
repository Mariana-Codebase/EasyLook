import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const demoAccounts = [
  { label: 'Usuario demo', email: 'demo@easylook.dev', password: 'Demo12345!' },
  { label: 'Administrador demo', email: 'admin@easylook.dev', password: 'Admin12345!' },
]

export function LoginPage() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/outfits" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
      navigate('/outfits')
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'No se pudo completar la solicitud.'))
    } finally {
      setBusy(false)
    }
  }

  const issues = (error?.details?.issues as { path: string; message: string }[] | undefined) ?? []

  return (
    <div className="page auth">
      <div className="auth-card panel">
        <div className="tabs" role="tablist" aria-label="Acceso">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Ingresar
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'register' && <p className="hint">Mínimo 8 caracteres.</p>}
          </div>
          {error && (
            <div className="error-text" role="alert">
              <p>{error.message}</p>
              {issues.length > 0 && (
                <ul>
                  {issues.map((i) => (
                    <li key={i.path + i.message}>{i.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="demo-accounts">
            <p>Cuentas de prueba del catálogo semilla</p>
            {demoAccounts.map((a) => (
              <button
                type="button"
                key={a.email}
                className="link-button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword(a.password)
                }}
              >
                Usar {a.label.toLowerCase()} ({a.email})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
