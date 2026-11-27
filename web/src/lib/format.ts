import type { BudgetStatus, Category } from '../api/client'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const formatCop = (amount: number) => cop.format(amount).replace(/ /g, ' ')

export const categoryLabel: Record<Category, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Vestido',
  shoes: 'Zapatos',
  outerwear: 'Chaqueta',
  accessory: 'Accesorio',
}

export const categoryOrder: Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']

export const styleLabel: Record<string, string> = {
  elegant: 'Elegante',
  minimal: 'Minimal',
  classic: 'Clásico',
  romantic: 'Romántico',
  boho: 'Boho',
  casual: 'Casual',
  streetwear: 'Streetwear',
  bold: 'Atrevido',
}

export const knownStyles = Object.keys(styleLabel)

export const styleName = (style: string) => styleLabel[style] ?? style

export const budgetStatusLabel: Record<BudgetStatus, string> = {
  not_set: 'Sin presupuesto',
  within_budget: 'Dentro del presupuesto',
  over_budget: 'Sobre el presupuesto',
}

export const recommendationLabel: Record<string, { title: string; hint: string }> = {
  balanced: { title: 'Equilibrado', hint: 'El mejor puntaje general' },
  budget: { title: 'Económico', hint: 'El menor costo con buen puntaje' },
  statement: { title: 'Destacado', hint: 'La opción más llamativa que cabe' },
}

export const colorName = (color: string) => color.replace(/-/g, ' ')
