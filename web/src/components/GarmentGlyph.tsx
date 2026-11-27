import { useId } from 'react'
import type { Category } from '../api/client'

/** Seed colors are Spanish slugs; each maps to the swatch used to paint the silhouette. */
const swatches: Record<string, string> = {
  negro: '#24252B',
  blanco: '#FBFBF8',
  marfil: '#F3ECDC',
  crema: '#EFE3C8',
  crudo: '#E9E1CD',
  champana: '#E4D0A2',
  beige: '#D8C3A0',
  natural: '#D7C096',
  nude: '#E2C3A6',
  camel: '#C29A6A',
  caqui: '#A8996B',
  cafe: '#71492F',
  terracota: '#BF6142',
  gris: '#9B9EA6',
  plateado: '#C9CCD3',
  dorado: '#C9A440',
  rosa: '#E7A3B6',
  'rosa-palo': '#E8C3C1',
  lila: '#B8A2D8',
  vino: '#6E2034',
  azul: '#3D5D94',
  'azul-marino': '#1F2D50',
  esmeralda: '#1E7A58',
  'verde-oliva': '#6C6B3B',
}

const swatchFor = (color: string) => swatches[color] ?? '#B4B8C3'

const shapes: Record<Category, { body: string; details?: string }> = {
  top: {
    body: 'M31 20 L43 13 Q50 20 57 13 L69 20 L87 37 L77 48 L68 41 L68 104 L32 104 L32 41 L23 48 L13 37 Z',
    details: 'M43 13 Q50 26 57 13',
  },
  bottom: {
    body: 'M28 12 L72 12 L77 110 L57 110 L50 42 L43 110 L23 110 Z',
    details: 'M28 21 L72 21 M50 21 L50 40',
  },
  dress: {
    body: 'M38 10 L43 14 Q50 21 57 14 L62 10 L65 32 L58 46 L84 110 L16 110 L42 46 L35 32 Z',
    details: 'M42 46 Q50 50 58 46',
  },
  outerwear: {
    body: 'M34 12 L50 22 L66 12 L85 22 L91 100 L77 100 L74 58 L71 108 L29 108 L26 58 L23 100 L9 100 L15 22 Z',
    details: 'M50 22 L41 50 M50 22 L59 50 M50 50 L50 108',
  },
  shoes: {
    body: 'M12 82 Q12 64 26 64 L42 66 Q58 69 68 80 L86 88 Q93 92 90 100 L18 100 Q12 100 12 94 Z',
    details: 'M12 94 L90 94',
  },
  accessory: {
    body: 'M22 50 L78 50 L85 104 L15 104 Z',
    details: 'M36 50 Q36 26 50 26 Q64 26 64 50',
  },
}

interface Props {
  category: Category
  color: string
  size?: number
  title?: string
}

/** Flat silhouette of a garment painted in its catalog color. */
export function GarmentGlyph({ category, color, size = 96, title }: Props) {
  const patternId = useId()
  const shape = shapes[category]
  const printed = color === 'estampado'
  const fill = printed ? `url(#${CSS.escape(patternId)})` : swatchFor(color)

  return (
    <svg
      className="glyph"
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {printed && (
        <defs>
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#F1E3D3" />
            <circle cx="4" cy="4" r="2.6" fill="#BF6142" />
            <circle cx="11" cy="10" r="2" fill="#3D5D94" />
            <circle cx="11" cy="3" r="1.2" fill="#1E7A58" />
          </pattern>
        </defs>
      )}
      <path d={shape.body} fill={fill} className="glyph-body" />
      {shape.details && <path d={shape.details} className="glyph-detail" fill="none" />}
      {category === 'accessory' && <path d={shapes.accessory.details} className="glyph-handle" fill="none" />}
    </svg>
  )
}
