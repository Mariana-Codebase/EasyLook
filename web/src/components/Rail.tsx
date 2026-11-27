import type { Category } from '../api/client'
import { categoryLabel, formatCop } from '../lib/format'
import { GarmentGlyph } from './GarmentGlyph'

export interface RailPiece {
  id: string
  name: string
  category: Category
  color: string
  priceCop: number
  storeName: string
  available?: boolean
}

interface Props {
  pieces: RailPiece[]
  onRemove?: (piece: RailPiece) => void
  removingId?: string | null
  emptyHint?: string
  size?: 'large' | 'small'
}

const hanging = new Set<Category>(['top', 'bottom', 'dress', 'outerwear'])

/** The outfit as a clothes rail: garments hang from the bar, shoes and accessories rest on the shelf. */
export function Rail({ pieces, onRemove, removingId, emptyHint, size = 'large' }: Props) {
  const onBar = pieces.filter((p) => hanging.has(p.category))
  const onShelf = pieces.filter((p) => !hanging.has(p.category))
  const glyphSize = size === 'large' ? 92 : 58

  const renderPiece = (piece: RailPiece, hung: boolean) => (
    <li key={piece.id} className={`rail-piece${piece.available === false ? ' rail-piece--gone' : ''}`}>
      {hung && (
        <svg className="hanger" viewBox="0 0 60 26" aria-hidden="true">
          <path d="M30 2 a4 4 0 0 1 4 4 c0 2-2 3-4 4 v3 L57 24 H3 L30 13" fill="none" />
        </svg>
      )}
      <GarmentGlyph category={piece.category} color={piece.color} name={piece.name} size={glyphSize} />
      <div className="rail-tag">
        <span className="rail-name">{piece.name}</span>
        <span className="rail-meta">
          {categoryLabel[piece.category]}, {piece.storeName}
        </span>
        <span className="rail-price">{formatCop(piece.priceCop)}</span>
        {piece.available === false && <span className="rail-warning">Ya no está disponible</span>}
        {onRemove && (
          <button
            type="button"
            className="link-button"
            onClick={() => onRemove(piece)}
            disabled={removingId === piece.id}
            aria-label={`Quitar ${piece.name} del outfit`}
          >
            {removingId === piece.id ? 'Quitando…' : 'Quitar'}
          </button>
        )}
      </div>
    </li>
  )

  return (
    <div className={`rail rail--${size}`}>
      <div className="rail-bar" aria-hidden="true" />
      {pieces.length === 0 ? (
        <p className="rail-empty">{emptyHint ?? 'Todavía no hay prendas.'}</p>
      ) : (
        <>
          <ul className="rail-hanging" aria-label="Prendas colgadas">
            {onBar.map((p) => renderPiece(p, true))}
          </ul>
          {onShelf.length > 0 && (
            <ul className="rail-shelf" aria-label="Zapatos y accesorios">
              {onShelf.map((p) => renderPiece(p, false))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
