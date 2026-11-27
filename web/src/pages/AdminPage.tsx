import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { api, unwrap, type Category, type Garment } from '../api/client'
import { useOccasions, useStores } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { GarmentGlyph } from '../components/GarmentGlyph'
import { useToast } from '../components/Toast'
import { categoryLabel, categoryOrder, formatCop, knownStyles, styleName } from '../lib/format'

/** Catalog maintenance for administrators (RF-10): create, edit and deactivate garments. */
export function AdminPage() {
  const { user, loading } = useAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Garment | null>(null)
  const [creating, setCreating] = useState(false)

  const garments = useQuery({
    queryKey: ['admin-garments', q, page],
    queryFn: () =>
      unwrap(
        api.GET('/garments', {
          params: { query: { q: q || undefined, includeInactive: 'true', page, limit: 15, sort: 'newest' } },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled: user?.role === 'admin',
  })

  if (loading) return <p className="page">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />
  if (user.role !== 'admin') {
    return (
      <div className="page">
        <h1 className="display">Solo administradores</h1>
        <p>Tu cuenta no tiene permisos para mantener el catálogo. La API respondería 403 FORBIDDEN.</p>
      </div>
    )
  }

  const meta = garments.data?.meta

  return (
    <div className="page admin">
      <header className="page-head">
        <h1 className="display">Catálogo</h1>
        <p className="lede">Las prendas desactivadas dejan de aparecer en la tienda y en Look Match, pero los outfits guardados las conservan.</p>
      </header>

      <div className="admin-toolbar">
        <div className="field field--inline">
          <label htmlFor="admin-q">Buscar</label>
          <input
            id="admin-q"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            setEditing(null)
            setCreating(true)
          }}
        >
          Nueva prenda
        </button>
      </div>

      {(creating || editing) && (
        <GarmentForm
          key={editing?.id ?? 'new'}
          garment={editing}
          onDone={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Prenda</th>
              <th scope="col">Tienda</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="num">
                Precio
              </th>
              <th scope="col">Ocasiones</th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {garments.data?.data.map((g) => (
              <AdminRow
                key={g.id}
                garment={g}
                onEdit={() => {
                  setCreating(false)
                  setEditing(g)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <nav className="pager" aria-label="Páginas">
          <button type="button" className="button button--quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="button button--quiet"
            disabled={page >= meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  )
}

function AdminRow({ garment, onEdit }: { garment: Garment; onEdit: () => void }) {
  const occasions = useOccasions()
  const occasionNames = new Map(occasions.data?.map((o) => [o.code, o.name]))
  const queryClient = useQueryClient()
  const { notify, fail } = useToast()
  const toggle = useMutation({
    mutationFn: () =>
      garment.active
        ? unwrap(api.DELETE('/garments/{garmentId}', { params: { path: { garmentId: garment.id } } }))
        : unwrap(
            api.PATCH('/garments/{garmentId}', { params: { path: { garmentId: garment.id } }, body: { active: true } }),
          ),
    onSuccess: () => {
      notify(garment.active ? `Desactivaste ${garment.name}.` : `Reactivaste ${garment.name}.`)
      void queryClient.invalidateQueries()
    },
    onError: fail,
  })

  return (
    <tr className={garment.active ? undefined : 'is-inactive'}>
      <th scope="row">
        <span className="cell-garment">
          <GarmentGlyph category={garment.category} color={garment.color} name={garment.name} size={28} />
          {garment.name}
        </span>
      </th>
      <td>{garment.store.name}</td>
      <td>{categoryLabel[garment.category]}</td>
      <td className="num">{formatCop(garment.priceCop)}</td>
      <td>{garment.occasions.map((code) => occasionNames.get(code) ?? code).join(', ')}</td>
      <td>{garment.active ? 'Activa' : 'Desactivada'}</td>
      <td>
        <span className="actions">
          <button type="button" className="link-button" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="link-button" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {garment.active ? 'Desactivar' : 'Reactivar'}
          </button>
        </span>
      </td>
    </tr>
  )
}

function GarmentForm({ garment, onDone }: { garment: Garment | null; onDone: () => void }) {
  const stores = useStores()
  const occasions = useOccasions()
  const queryClient = useQueryClient()
  const { notify, fail } = useToast()
  const [form, setForm] = useState({
    name: garment?.name ?? '',
    storeId: garment?.store.id ?? '',
    category: (garment?.category ?? 'top') as Category,
    priceCop: garment ? String(garment.priceCop) : '',
    style: garment?.style ?? 'casual',
    color: garment?.color ?? '',
    sizes: garment?.sizes.join(', ') ?? 'S, M, L',
    occasionCodes: garment?.occasions ?? ([] as string[]),
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        storeId: form.storeId,
        category: form.category,
        priceCop: Number(form.priceCop),
        style: form.style,
        color: form.color.trim(),
        sizes: form.sizes.split(/[\s,]+/).filter(Boolean),
        occasionCodes: form.occasionCodes,
      }
      return garment
        ? unwrap(api.PATCH('/garments/{garmentId}', { params: { path: { garmentId: garment.id } }, body }))
        : unwrap(api.POST('/garments', { body }))
    },
    onSuccess: (saved) => {
      notify(garment ? `Actualizaste ${saved.name}.` : `Creaste ${saved.name}.`)
      void queryClient.invalidateQueries()
      onDone()
    },
    onError: fail,
  })

  return (
    <form
      className="panel form garment-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <h2>{garment ? `Editar ${garment.name}` : 'Nueva prenda'}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="g-name">Nombre</label>
          <input id="g-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-store">Tienda</label>
          <select id="g-store" required value={form.storeId} onChange={(e) => set('storeId', e.target.value)}>
            <option value="" disabled>
              Elige una
            </option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-category">Tipo</label>
          <select id="g-category" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
            {categoryOrder.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-price">Precio en pesos</label>
          <input
            id="g-price"
            required
            inputMode="numeric"
            value={form.priceCop}
            onChange={(e) => set('priceCop', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="field">
          <label htmlFor="g-style">Estilo</label>
          <select id="g-style" value={form.style} onChange={(e) => set('style', e.target.value)}>
            {knownStyles.map((s) => (
              <option key={s} value={s}>
                {styleName(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-color">Color</label>
          <input id="g-color" required placeholder="azul-marino" value={form.color} onChange={(e) => set('color', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-sizes">Tallas</label>
          <input id="g-sizes" value={form.sizes} onChange={(e) => set('sizes', e.target.value)} />
        </div>
      </div>
      <fieldset className="field">
        <legend>Ocasiones</legend>
        <div className="chips">
          {occasions.data?.map((o) => {
            const on = form.occasionCodes.includes(o.code)
            return (
              <button
                type="button"
                key={o.code}
                className={`chip${on ? ' is-active' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  set('occasionCodes', on ? form.occasionCodes.filter((c) => c !== o.code) : [...form.occasionCodes, o.code])
                }
              >
                {o.name}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="form-actions">
        <button type="submit" className="button" disabled={save.isPending}>
          {garment ? 'Guardar cambios' : 'Crear prenda'}
        </button>
        <button type="button" className="link-button" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
