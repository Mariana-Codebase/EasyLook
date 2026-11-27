import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ApiError, unwrap, type Category, type Outfit } from '../api/client'
import { useAddItem, useOccasions, useOutfit, useOutfitCache, useRemoveItem } from '../api/hooks'
import { BudgetMeter } from '../components/BudgetMeter'
import { GarmentGlyph } from '../components/GarmentGlyph'
import { Rail } from '../components/Rail'
import { useToast } from '../components/Toast'
import { categoryLabel, formatCop } from '../lib/format'

export function OutfitPage() {
  const { outfitId } = useParams()
  const outfit = useOutfit(outfitId)

  if (outfit.isPending) return <p className="page">Cargando outfit…</p>
  if (outfit.isError) {
    const error = outfit.error as ApiError
    return (
      <div className="page">
        <h1 className="display">No se pudo abrir el outfit</h1>
        <p className="error-text">
          {error.message} <code>{error.code}</code>
        </p>
        <Link to="/outfits">Volver a mis outfits</Link>
      </div>
    )
  }
  return <FittingRoom outfit={outfit.data} />
}

function FittingRoom({ outfit }: { outfit: Outfit }) {
  const removeItem = useRemoveItem()
  const cache = useOutfitCache()
  const navigate = useNavigate()
  const { notify, fail } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [overBudgetBlocked, setOverBudgetBlocked] = useState(false)

  const finalize = useMutation({
    mutationFn: (allowOverBudget: boolean) =>
      unwrap(
        api.POST('/outfits/{outfitId}/finalize', {
          params: { path: { outfitId: outfit.id } },
          body: { allowOverBudget },
        }),
      ),
    onSuccess: (saved) => {
      cache.put(saved)
      setOverBudgetBlocked(false)
      notify(`${saved.name} quedó guardado en tu look book.`)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'BUDGET_EXCEEDED') setOverBudgetBlocked(true)
      fail(error)
    },
  })

  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/outfits/{outfitId}', { params: { path: { outfitId: outfit.id } } })),
    onSuccess: () => {
      cache.drop(outfit.id)
      notify(`Eliminaste ${outfit.name}.`)
      navigate('/outfits')
    },
    onError: fail,
  })

  const pieces = outfit.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    priceCop: item.priceCop,
    storeName: item.store.name,
    available: item.available,
  }))

  return (
    <div className="page fitting">
      <header className="page-head fitting-head">
        <div>
          <p className="crumb">
            <Link to="/outfits">Mis outfits</Link>
          </p>
          <h1 className="display">{outfit.name}</h1>
          <p className="lede">
            {outfit.occasion.name}. {outfit.status === 'saved' ? 'Guardado en el look book.' : 'Borrador.'}{' '}
            {outfit.storeCount > 1 && `Mezcla ${outfit.storeCount} tiendas.`}
          </p>
        </div>
        <div className="fitting-actions">
          <button type="button" className="button button--quiet" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cerrar edición' : 'Editar datos'}
          </button>
          {confirmDelete ? (
            <span className="confirm">
              ¿Eliminar este outfit?
              <button type="button" className="button button--danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Eliminar
              </button>
              <button type="button" className="link-button" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" className="button button--quiet" onClick={() => setConfirmDelete(true)}>
              Eliminar
            </button>
          )}
        </div>
      </header>

      {editing && <EditOutfitForm outfit={outfit} onDone={() => setEditing(false)} />}

      <div className="fitting-layout">
        <section aria-label="Prendas del outfit">
          <Rail
            pieces={pieces}
            removingId={removeItem.isPending ? removeItem.variables?.garmentId : null}
            onRemove={(piece) =>
              removeItem.mutate(
                { outfitId: outfit.id, garmentId: piece.id },
                { onSuccess: () => notify(`Quitaste ${piece.name}.`), onError: fail },
              )
            }
            emptyHint="El riel está vacío. Agrega prendas desde la tienda o con las sugerencias de abajo."
          />
          <Suggestions outfit={outfit} />
        </section>

        <aside className="panel fitting-panel">
          <BudgetMeter
            budgetCop={outfit.budgetCop}
            totalCop={outfit.totalCop}
            remainingCop={outfit.remainingCop}
            budgetStatus={outfit.budgetStatus}
          />
          <Completeness outfit={outfit} />
          {outfit.status === 'saved' ? (
            <p className="saved-note">Guardado el {new Date(outfit.savedAt!).toLocaleDateString('es-CO', { dateStyle: 'long' })}.</p>
          ) : (
            <div className="finalize">
              <button
                type="button"
                className="button"
                disabled={finalize.isPending}
                onClick={() => finalize.mutate(false)}
              >
                Guardar en el look book
              </button>
              {overBudgetBlocked && (
                <button
                  type="button"
                  className="button button--quiet"
                  disabled={finalize.isPending}
                  onClick={() => finalize.mutate(true)}
                >
                  Guardar aunque me pase del presupuesto
                </button>
              )}
            </div>
          )}
          <Link to={`/look-match?occasion=${outfit.occasion.code}${outfit.budgetCop ? `&budget=${outfit.budgetCop}` : ''}`}>
            Pedir ideas a Look Match para esta ocasión
          </Link>
        </aside>
      </div>
    </div>
  )
}

function Completeness({ outfit }: { outfit: Outfit }) {
  const has = new Set(outfit.items.map((i) => i.category))
  const rows: { label: string; done: boolean }[] = has.has('dress')
    ? [
        { label: 'Vestido', done: true },
        { label: 'Zapatos', done: has.has('shoes') },
      ]
    : [
        { label: 'Top', done: has.has('top') },
        { label: 'Bottom', done: has.has('bottom') },
        { label: 'Zapatos', done: has.has('shoes') },
      ]
  return (
    <div className="checklist">
      <h2>{outfit.isComplete ? 'Look completo' : 'Para que el look esté completo'}</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.label} className={r.done ? 'is-done' : undefined}>
            <span className="check" aria-hidden="true" />
            {r.label}
            <span className="visually-hidden">{r.done ? ', listo' : ', falta'}</span>
          </li>
        ))}
      </ul>
      {!has.has('dress') && !outfit.isComplete && <p className="hint">Un vestido reemplaza el top y el bottom.</p>}
    </div>
  )
}

/** Garments for this occasion in the categories the outfit is still missing. */
function Suggestions({ outfit }: { outfit: Outfit }) {
  const addItem = useAddItem()
  const { notify, fail } = useToast()
  const missing = outfit.missingCategories as Category[]
  const category: Category | undefined = missing[0]
  const inOutfit = new Set(outfit.items.map((i) => i.id))

  const garments = useQuery({
    queryKey: ['suggestions', outfit.occasion.code, category],
    queryFn: () =>
      unwrap(
        api.GET('/garments', {
          params: { query: { occasion: outfit.occasion.code, category, sort: 'price_asc', limit: 8 } },
        }),
      ),
    enabled: category !== undefined,
  })

  if (!category) return null
  const options = (garments.data?.data ?? []).filter((g) => !inOutfit.has(g.id))

  return (
    <section className="suggestions">
      <h2>
        Falta: {missing.map((c) => categoryLabel[c].toLowerCase()).join(', ')}. Opciones de {categoryLabel[category].toLowerCase()} para{' '}
        {outfit.occasion.name.toLowerCase()}
      </h2>
      <ul>
        {options.map((g) => (
          <li key={g.id}>
            <GarmentGlyph category={g.category} color={g.color} name={g.name} size={44} />
            <div>
              <span className="suggestion-name">{g.name}</span>
              <span className="suggestion-meta">
                {g.store.name}, {formatCop(g.priceCop)}
              </span>
            </div>
            <button
              type="button"
              className="button button--small"
              disabled={addItem.isPending}
              onClick={() =>
                addItem.mutate(
                  { outfitId: outfit.id, garmentId: g.id },
                  { onSuccess: () => notify(`Agregaste ${g.name}.`), onError: fail },
                )
              }
            >
              Agregar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EditOutfitForm({ outfit, onDone }: { outfit: Outfit; onDone: () => void }) {
  const occasions = useOccasions()
  const cache = useOutfitCache()
  const { notify, fail } = useToast()
  const [name, setName] = useState(outfit.name)
  const [occasionCode, setOccasionCode] = useState(outfit.occasion.code)
  const [budget, setBudget] = useState(outfit.budgetCop === null ? '' : String(outfit.budgetCop))

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH('/outfits/{outfitId}', {
          params: { path: { outfitId: outfit.id } },
          body: { name: name.trim(), occasionCode, budgetCop: budget === '' ? null : Number(budget) },
        }),
      ),
    onSuccess: (updated) => {
      cache.put(updated)
      notify(
        updated.status === 'draft' && outfit.status === 'saved'
          ? 'Cambios guardados. El outfit volvió a borrador porque cambió la ocasión o el presupuesto.'
          : 'Cambios guardados.',
      )
      onDone()
    },
    onError: fail,
  })

  return (
    <form
      className="panel form form--row"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <div className="field">
        <label htmlFor="edit-name">Nombre</label>
        <input id="edit-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="edit-occasion">Ocasión</label>
        <select id="edit-occasion" value={occasionCode} onChange={(e) => setOccasionCode(e.target.value)}>
          {occasions.data?.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="edit-budget">Presupuesto (vacío para quitarlo)</label>
        <input
          id="edit-budget"
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <button type="submit" className="button" disabled={save.isPending}>
        Guardar cambios
      </button>
    </form>
  )
}
