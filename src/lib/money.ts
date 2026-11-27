const copFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Formats an integer amount of Colombian pesos for human-readable messages, e.g. `$28.000 COP`. */
export function formatCop(amount: number): string {
  return `$${copFormatter.format(amount)} COP`;
}

export const CURRENCY = 'COP' as const;
