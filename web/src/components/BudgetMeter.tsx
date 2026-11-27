import type { BudgetStatus } from '../api/client'
import { budgetStatusLabel, formatCop } from '../lib/format'

interface Props {
  budgetCop: number | null
  totalCop: number
  remainingCop: number | null
  budgetStatus: BudgetStatus
  compact?: boolean
}

/** Spent vs. budget, recalculated by the API every time a garment is added or removed. */
export function BudgetMeter({ budgetCop, totalCop, remainingCop, budgetStatus, compact = false }: Props) {
  const ratio = budgetCop ? totalCop / budgetCop : 0
  const width = budgetCop ? Math.min(ratio, 1) * 100 : 0
  const overflow = budgetCop && ratio > 1 ? Math.min((ratio - 1) * 100, 100) : 0

  return (
    <div className={`meter meter--${budgetStatus}${compact ? ' meter--compact' : ''}`}>
      <div className="meter-figures">
        <div>
          <span className="meter-caption">Total</span>
          <strong className="meter-total">{formatCop(totalCop)}</strong>
        </div>
        {budgetCop !== null && (
          <div className="meter-right">
            <span className="meter-caption">{(remainingCop ?? 0) < 0 ? 'Te pasas por' : 'Te quedan'}</span>
            <strong className="meter-remaining">{formatCop(Math.abs(remainingCop ?? 0))}</strong>
          </div>
        )}
      </div>
      {budgetCop !== null ? (
        <>
          <div
            className="meter-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={budgetCop}
            aria-valuenow={totalCop}
            aria-label={`Gastado ${formatCop(totalCop)} de ${formatCop(budgetCop)}`}
          >
            <div className="meter-fill" style={{ width: `${width}%` }} />
            {overflow > 0 && <div className="meter-overflow" style={{ width: `${overflow}%` }} />}
          </div>
          {!compact && (
            <p className="meter-status">
              {budgetStatusLabel[budgetStatus]} de {formatCop(budgetCop)}
            </p>
          )}
        </>
      ) : (
        !compact && <p className="meter-status">Sin presupuesto definido</p>
      )}
    </div>
  )
}
