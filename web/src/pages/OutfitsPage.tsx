import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, unwrap, type OutfitSummary } from '../api/client'
import { useMyOutfits, useOccasions, useOutfitCache } from '../api/hooks'
import { BudgetMeter } from '../components/BudgetMeter'
import { useToast } from '../components/Toast'

export function OutfitsPage() {
  const outfits = useMyOutfits()
  const all = outfits.data?.data ?? []
  const saved = all.filter((o) => o.status === 'saved')
  const drafts = all.filter((o) => o.status === 'draft')

  return (
    <div className="page page--outfits">
      <header className="page-head">
        <h1 className="display">Mis outfits</h1>
        <p className="lede">Los borradores se pueden editar libremente. Al guardar un outfit en el look book, la API valida que esté completo y dentro del presupuesto.</p>
      </header>

      <div className="outfits-layout">
        <NewOutfitForm />
        <div className="outfit-lists">
          {outfits.isPending && <p>Cargando outfits…</p>}
          {outfits.isError && <p className="error-text">{(outfits.error as Error).message}</p>}
          <OutfitList title="Look book" items={saved} empty="Aún no has guardado ningún look." />
          <OutfitList title="Borradores" items={drafts} empty="No tienes borradores." />
        </div>
      </div>
    </div>
  )
}

function OutfitList({ title, items, empty }: { title: string; items: OutfitSummary[]; empty: string }) {
  return (
    <section className="outfit-list">
      <h2>
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul>
          {items.map((o) => (
            <li key={o.id}>
              <Link to={`/outfits/${o.id}`} className="outfit-row">
                <div className="outfit-row-title">
                  <strong>{o.name}</strong>
                  <span>
                    {o.occasion.name}, {o.itemCount} {o.itemCount === 1 ? 'prenda' : 'prendas'}
                  </span>
                </div>
                <BudgetMeter
                  compact
                  budgetCop={o.budgetCop}
                  totalCop={o.totalCop}
                  remainingCop={o.remainingCop}
                  budgetStatus={o.budgetStatus}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NewOutfitForm() {
  const occasions = useOccasions()
  const navigate = useNavigate()
  const cache = useOutfitCache()
  const { fail } = useToast()
  const [name, setName] = useState('')
  const [occasionCode, setOccasionCode] = useState('')
  const [budget, setBudget] = useState('')

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/outfits', {
          body: {
            name: name.trim(),
            occasionCode,
            ...(budget && { budgetCop: Number(budget) }),
            currency: 'COP',
          },
        }),
      ),
    onSuccess: (outfit) => {
      cache.put(outfit)
      localStorage.setItem('easylook.activeOutfit', outfit.id)
      navigate(`/outfits/${outfit.id}`)
    },
    onError: fail,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Nuevo outfit</h2>
      <div className="field">
        <label htmlFor="outfit-name">Nombre</label>
        <input
          id="outfit-name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          placeholder="Brunch de domingo"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="outfit-occasion">Ocasión</label>
        <select id="outfit-occasion" required value={occasionCode} onChange={(e) => setOccasionCode(e.target.value)}>
          <option value="" disabled>
            Elige una
          </option>
          {occasions.data?.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="outfit-budget">Presupuesto en pesos (opcional)</label>
        <input
          id="outfit-budget"
          inputMode="numeric"
          pattern="[0-9]*"
          value={budget}
          placeholder="350000"
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <button type="submit" className="button" disabled={create.isPending}>
        {create.isPending ? 'Creando…' : 'Crear outfit'}
      </button>
    </form>
  )
}
