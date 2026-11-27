import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, unwrap, type Category, type Garment, type OutfitSummary } from '../api/client'
import { useActiveOutfit, useAddItem, useOccasions, useStores } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { BudgetMeter } from '../components/BudgetMeter'
import { GarmentGlyph } from '../components/GarmentGlyph'
import { useToast } from '../components/Toast'
import { categoryLabel, categoryOrder, colorName, formatCop, knownStyles, styleName } from '../lib/format'

const PAGE_SIZE = 18
type Sort = 'name' | 'price_asc' | 'price_desc' | 'newest'

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const occasions = useOccasions()
  const stores = useStores()
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '')
  const activeOutfit = useActiveOutfit()

  const filters = {
    occasion: params.get('occasion') ?? undefined,
    category: (params.get('category') as Category | null) ?? undefined,
    style: params.get('style') ?? undefined,
    storeId: params.get('storeId') ?? undefined,
    maxPriceCop: params.get('max') ? Number(params.get('max')) : undefined,
    q: params.get('q') ?? undefined,
    sort: (params.get('sort') as Sort | null) ?? 'name',
    page: Number(params.get('page') ?? 1),
    limit: PAGE_SIZE,
  }

  const garments = useQuery({
    queryKey: ['garments', filters],
    queryFn: () => unwrap(api.GET('/garments', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const selectedOccasion = occasions.data?.find((o) => o.code === filters.occasion)
  const meta = garments.data?.meta

  return (
    <div className="catalog">
      <section className="catalog-intro">
        <h1 className="display">¿Para qué te vistes?</h1>
        <div className="occasion-picker" role="group" aria-label="Ocasión">
          <button
            type="button"
            className={`occasion${!filters.occasion ? ' is-active' : ''}`}
            aria-pressed={!filters.occasion}
            onClick={() => update('occasion', undefined)}
          >
            Todo
          </button>
          {occasions.data?.map((o) => (
            <button
              type="button"
              key={o.code}
              className={`occasion${filters.occasion === o.code ? ' is-active' : ''}`}
              aria-pressed={filters.occasion === o.code}
              onClick={() => update('occasion', o.code)}
            >
              {o.name}
            </button>
          ))}
        </div>
        <p className="lede">
          {selectedOccasion
            ? `${selectedOccasion.description} Funcionan mejor los estilos ${selectedOccasion.recommendedStyles.map(styleName).join(', ').toLowerCase()}.`
            : 'Prendas de siete tiendas ficticias. Elige una ocasión, mezcla tiendas y mira cuánto te queda del presupuesto mientras armas el look.'}
        </p>
      </section>

      {user ? <ActiveOutfitBar {...activeOutfit} /> : (
        <div className="notice">
          <Link to="/ingresar">Ingresa</Link> para guardar prendas en un outfit y ver tu presupuesto mientras compras.
        </div>
      )}

      <div className="catalog-body">
        <aside className="filters" aria-label="Filtros">
          <form
            className="field"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              update('q', searchDraft.trim() || undefined)
            }}
          >
            <label htmlFor="q">Buscar</label>
            <input
              id="q"
              type="search"
              value={searchDraft}
              placeholder="Blazer, falda, tenis…"
              onChange={(e) => setSearchDraft(e.target.value)}
              onBlur={() => update('q', searchDraft.trim() || undefined)}
            />
          </form>

          <fieldset className="field">
            <legend>Tipo de prenda</legend>
            <div className="chips">
              {categoryOrder.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip${filters.category === c ? ' is-active' : ''}`}
                  aria-pressed={filters.category === c}
                  onClick={() => update('category', filters.category === c ? undefined : c)}
                >
                  {categoryLabel[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Estilo</legend>
            <div className="chips">
              {knownStyles.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`chip${filters.style === s ? ' is-active' : ''}`}
                  aria-pressed={filters.style === s}
                  onClick={() => update('style', filters.style === s ? undefined : s)}
                >
                  {styleName(s)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="store">Tienda</label>
            <select id="store" value={filters.storeId ?? ''} onChange={(e) => update('storeId', e.target.value || undefined)}>
              <option value="">Todas</option>
              {stores.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="max">Precio máximo</label>
            <select id="max" value={params.get('max') ?? ''} onChange={(e) => update('max', e.target.value || undefined)}>
              <option value="">Sin límite</option>
              {[60000, 100000, 150000, 200000, 250000].map((v) => (
                <option key={v} value={v}>
                  {formatCop(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sort">Ordenar</label>
            <select id="sort" value={filters.sort} onChange={(e) => update('sort', e.target.value)}>
              <option value="name">Nombre</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
              <option value="newest">Más recientes</option>
            </select>
          </div>

          {[...params.keys()].length > 0 && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setSearchDraft('')
                setParams(new URLSearchParams(), { replace: true })
              }}
            >
              Quitar filtros
            </button>
          )}
        </aside>

        <section className="results" aria-busy={garments.isFetching} aria-label="Prendas">
          <p className="results-count">
            {meta ? `${meta.total} ${meta.total === 1 ? 'prenda' : 'prendas'}` : 'Cargando prendas…'}
          </p>
          {garments.isError && <p className="error-text">{(garments.error as Error).message}</p>}
          {meta?.total === 0 && (
            <p className="empty">No hay prendas con esos filtros. Prueba con otra ocasión o sube el precio máximo.</p>
          )}
          <ul className="garment-grid">
            {garments.data?.data.map((g) => (
              <GarmentTile key={g.id} garment={g} active={user ? activeOutfit.active : null} />
            ))}
          </ul>
          {meta && meta.totalPages > 1 && (
            <nav className="pager" aria-label="Páginas">
              <button
                type="button"
                className="button button--quiet"
                disabled={meta.page <= 1}
                onClick={() => update('page', String(meta.page - 1))}
              >
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="button button--quiet"
                disabled={meta.page >= meta.totalPages}
                onClick={() => update('page', String(meta.page + 1))}
              >
                Siguiente
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}

type ActiveOutfit = ReturnType<typeof useActiveOutfit>

function ActiveOutfitBar({ drafts, active, choose }: ActiveOutfit) {
  if (drafts.length === 0) {
    return (
      <div className="notice">
        No tienes outfits en borrador. <Link to="/outfits">Crea uno</Link> para empezar a agregar prendas.
      </div>
    )
  }
  return (
    <div className="active-bar">
      <div className="field field--inline">
        <label htmlFor="active-outfit">Agregando a</label>
        <select id="active-outfit" value={active?.id ?? ''} onChange={(e) => choose(e.target.value)}>
          {drafts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.occasion.name})
            </option>
          ))}
        </select>
      </div>
      {active && (
        <>
          <BudgetMeter
            compact
            budgetCop={active.budgetCop}
            totalCop={active.totalCop}
            remainingCop={active.remainingCop}
            budgetStatus={active.budgetStatus}
          />
          <Link to={`/outfits/${active.id}`} className="button button--quiet">
            Ir al probador ({active.itemCount})
          </Link>
        </>
      )}
    </div>
  )
}

function GarmentTile({ garment, active }: { garment: Garment; active: OutfitSummary | null }) {
  const addItem = useAddItem()
  const { notify, fail } = useToast()

  const add = () => {
    if (!active) return
    addItem.mutate(
      { outfitId: active.id, garmentId: garment.id },
      {
        onSuccess: (result) => {
          const left =
            result.remainingCop === null
              ? `Total ${formatCop(result.totalCop)}.`
              : result.remainingCop >= 0
                ? `Te quedan ${formatCop(result.remainingCop)}.`
                : `Te pasas por ${formatCop(-result.remainingCop)}.`
          notify(`${garment.name} quedó en ${active.name}. ${left}`)
        },
        onError: fail,
      },
    )
  }

  return (
    <li className="garment">
      <div className="garment-figure">
        <GarmentGlyph category={garment.category} color={garment.color} size={84} />
      </div>
      <div className="garment-info">
        <h3 className="garment-name">{garment.name}</h3>
        <p className="garment-meta">
          {garment.store.name}, {styleName(garment.style).toLowerCase()}, {colorName(garment.color)}
        </p>
        <p className="garment-price">{formatCop(garment.priceCop)}</p>
      </div>
      {active && (
        <button type="button" className="button button--small" onClick={add} disabled={addItem.isPending}>
          {addItem.isPending ? 'Agregando…' : 'Agregar'}
        </button>
      )}
    </li>
  )
}
