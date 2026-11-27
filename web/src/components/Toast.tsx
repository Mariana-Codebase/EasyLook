import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'

type Tone = 'info' | 'error'
interface ToastMessage {
  id: number
  tone: Tone
  text: string
  code?: string
}

const ToastContext = createContext<{
  notify: (text: string) => void
  fail: (error: unknown) => void
} | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const nextId = useRef(1)

  const push = useCallback((tone: Tone, text: string, code?: string) => {
    const id = nextId.current++
    setMessages((current) => [...current.slice(-2), { id, tone, text, code }])
    window.setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), tone === 'error' ? 7000 : 3500)
  }, [])

  const notify = useCallback((text: string) => push('info', text), [push])
  const fail = useCallback(
    (error: unknown) =>
      error instanceof ApiError
        ? push('error', error.message, error.code)
        : push('error', 'Algo falló en la interfaz. Recarga la página e intenta de nuevo.'),
    [push],
  )

  return (
    <ToastContext.Provider value={{ notify, fail }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`toast toast--${m.tone}`}>
            <span>{m.text}</span>
            {m.code && <code className="toast-code">{m.code}</code>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
