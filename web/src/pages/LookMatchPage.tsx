import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, ApiError, unwrap, type Category, type LookMatchResponse, type Recommendation } from '../api/client'
import { useOccasions, useOutfitCache } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { Rail } from '../components/Rail'
import { useToast } from '../components/Toast'
import { categoryLabel, formatCop, knownStyles, recommendationLabel, styleName } from '../lib/format'

const weights = [
  { key: 'occasion', label: 'Ocasión', weight: 40 },
  { key: 'style', label: 'Estilo', weight: 30 },
  { key: 'budget', label: 'Presupuesto', weight: 20 },
  { key: 'storeVariety', label: 'Variedad de tiendas', weight: 10 },
] as const

const excludable: Category[] = ['dress', 'top', 'bottom', 'outerwear', 'accessory']

export function LookMatchPage() {
  const [params] = useSearchParams()
  const occasions = useOccasions()
  const { user } = useAuth()
  const [occasionCode, setOccasionCode] = useState(params.get('occasion') ?? 'date')
  const [budget, setBudget] = useState(params.get('budget') ?? '400000')
  const [styles, setStyles] = useState<string[]>([])
  const [excluded, setExcluded] = useState<Category[]>([])
  const [sizes, setSizes] = useState('')
  const [allowOverBudget, setAllowOverBudget] = useState(false)

  const match = useMutation<LookMatchResponse, ApiError>({
    mutationFn: () =>
      unwrap(
        api.POST('/recommendations/look-match', {
          body: {
            occasionCode,
            ...(budget && { budgetCop: Number(budget) }),
            ...(styles.length > 0 && { preferredStyles: styles }),
            excludedCategories: excluded,
            ...(sizes.trim() && { sizes: sizes.split(/[\s,]+/).filter(Boolean) }),
            allowOverBudget,
          },
        }),
      ),
  })

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const occasion = occasions.data?.find((o) => o.code === occasionCode)

  return (
    <div className="page lookmatch">
      <header className="page-head">
        <h1 className="display">Look Match</h1>
        <p className="lede">
          Dile la ocasión y cuánto quieres gastar. Look Match revisa todas las combinaciones completas del catálogo, las puntúa
          con reglas fijas y te muestra hasta tres, cada una con las razones de su puntaje.
        </p>
      </header>

      <div className="lookmatch-layout">
        <form
          className="panel form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            match.mutate()
          }}
        >
          <div className="field">
            <label htmlFor="lm-occasion">Ocasión</label>
            <select id="lm-occasion" value={occasionCode} onChange={(e) => setOccasionCode(e.target.value)}>
              {occasions.data?.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lm-budget">Presupuesto en pesos</label>
            <input
              id="lm-budget"
              inputMode="numeric"
              value={budget}
              placeholder="Sin límite"
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <fieldset className="field">
            <legend>Estilos que prefieres</legend>
            <div className="chips">
              {knownStyles.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`chip${styles.includes(s) ? ' is-active' : ''}`}
                  aria-pressed={styles.includes(s)}
                  onClick={() => setStyles((list) => toggle(list, s))}
                >
                  {styleName(s)}
                </button>
              ))}
            </div>
            {styles.length === 0 && user && user.preferredStyles.length > 0 && (
              <p className="hint">Se usarán los de tu perfil: {user.preferredStyles.map(styleName).join(', ')}.</p>
            )}
          </fieldset>
          <fieldset className="field">
            <legend>No incluir</legend>
            <div className="chips">
              {excludable.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip${excluded.includes(c) ? ' is-active' : ''}`}
                  aria-pressed={excluded.includes(c)}
                  onClick={() => setExcluded((list) => toggle(list, c))}
                >
                  {categoryLabel[c]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="lm-sizes">Tallas (opcional)</label>
            <input id="lm-sizes" value={sizes} placeholder="M, 38" onChange={(e) => setSizes(e.target.value)} />
          </div>
          <label className="check-field">
            <input type="checkbox" checked={allowOverBudget} onChange={(e) => setAllowOverBudget(e.target.checked)} />
            Si nada cabe, muéstrame la opción más cercana
          </label>
          <button type="submit" className="button" disabled={match.isPending}>
            {match.isPending ? 'Buscando combinaciones…' : 'Buscar looks'}
          </button>
        </form>

        <section className="lookmatch-results" aria-live="polite">
          {match.isIdle && (
            <div className="placeholder">
              <p>
                {occasion
                  ? `Para ${occasion.name.toLowerCase()} pesan más las prendas ${occasion.recommendedStyles.map(styleName).join(', ').toLowerCase()}.`
                  : 'Elige una ocasión para empezar.'}
              </p>
              <ScoreLegend />
            </div>
          )}
          {match.isError && <NoMatch error={match.error} />}
          {match.data && (
            <>
              <p className="results-count">
                {match.data.evaluatedCombinations} combinaciones evaluadas.{' '}
                {match.data.appliedPreferences.source === 'profile' && 'Usé las preferencias de tu perfil.'}
              </p>
              {match.data.notice && <p className="notice notice--warn">{match.data.notice}</p>}
              <ol className="proposals">
                {match.data.recommendations.map((rec) => (
                  <Proposal key={rec.label} rec={rec} occasionCode={match.data.occasion} budgetCop={match.data.budgetCop} />
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function ScoreLegend() {
  return (
    <dl className="legend">
      {weights.map((w) => (
        <div key={w.key}>
          <dt>{w.label}</dt>
          <dd>{w.weight} %</dd>
        </div>
      ))}
    </dl>
  )
}

function NoMatch({ error }: { error: ApiError }) {
  const cheapest = error.details?.cheapestTotalCop as number | undefined
  const missing = error.details?.missingCategories as Category[] | undefined
  return (
    <div className="notice notice--warn">
      <p>{error.message}</p>
      {cheapest !== undefined && <p>Sube el presupuesto a {formatCop(cheapest)} o marca la opción de mostrar la más cercana.</p>}
      {missing && <p>Quita la exclusión de {missing.map((c) => categoryLabel[c].toLowerCase()).join(', ')}.</p>}
      <code>{error.code}</code>
    </div>
  )
}

function Proposal({ rec, occasionCode, budgetCop }: { rec: Recommendation; occasionCode: string; budgetCop: number | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cache = useOutfitCache()
  const { notify, fail } = useToast()
  const label = recommendationLabel[rec.label] ?? { title: rec.label, hint: '' }

  const tryOn = useMutation({
    mutationFn: async () => {
      const outfit = await unwrap(
        api.POST('/outfits', {
          body: {
            name: `Look ${label.title.toLowerCase()} de Look Match`,
            occasionCode,
            ...(budgetCop !== null && { budgetCop }),
          },
        }),
      )
      return unwrap(
        api.POST('/outfits/{outfitId}/apply-recommendation', {
          params: { path: { outfitId: outfit.id } },
          body: { garmentIds: rec.garmentIds, mode: 'replace' },
        }),
      )
    },
    onSuccess: (outfit) => {
      cache.put(outfit)
      notify('Creé un outfit con esta propuesta. Revísalo y guárdalo en tu look book.')
      navigate(`/outfits/${outfit.id}`)
    },
    onError: fail,
  })

  return (
    <li className={`proposal proposal--${rec.label}`}>
      <header className="proposal-head">
        <div>
          <h2>{label.title}</h2>
          <p>{label.hint}</p>
        </div>
        <p className="score" aria-label={`Puntaje ${rec.score} de 100`}>
          {rec.score}
        </p>
      </header>

      <Rail
        size="small"
        pieces={rec.items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          color: i.color,
          priceCop: i.priceCop,
          storeName: i.store.name,
        }))}
      />

      <p className="proposal-total">
        <strong>{formatCop(rec.totalCop)}</strong>
        {rec.remainingCop !== null &&
          (rec.remainingCop >= 0 ? ` y te quedan ${formatCop(rec.remainingCop)}` : ` y te pasas por ${formatCop(-rec.remainingCop)}`)}
      </p>

      <dl className="breakdown">
        {weights.map((w) => (
          <div key={w.key} className="breakdown-row">
            <dt>
              {w.label} <span>{w.weight} %</span>
            </dt>
            <dd>
              <span className="breakdown-bar" style={{ width: `${rec.scoreBreakdown[w.key] * 100}%` }} />
            </dd>
          </div>
        ))}
      </dl>

      <ul className="reasons">
        {rec.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {user ? (
        <button type="button" className="button" disabled={tryOn.isPending} onClick={() => tryOn.mutate()}>
          {tryOn.isPending ? 'Creando outfit…' : 'Probar este look'}
        </button>
      ) : (
        <p className="hint">
          <Link to="/ingresar">Ingresa</Link> para convertir esta propuesta en un outfit.
        </p>
      )}
    </li>
  )
}
