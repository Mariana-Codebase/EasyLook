/**
 * Applies the requested sizes category by category. A shoe size such as `37` only filters
 * shoes and a clothing size such as `M` only filters clothing, so asking for one never
 * empties the other. Pieces without sizes (bags, jewelry) always fit.
 */
export function filterBySizes<T extends { category: string; sizes: string[] }>(pieces: T[], sizes: string[]): T[] {
  if (sizes.length === 0) return pieces;
  const requested = new Set(sizes);
  const relevantByCategory = new Map<string, boolean>();
  for (const piece of pieces) {
    if (piece.sizes.some((size) => requested.has(size))) relevantByCategory.set(piece.category, true);
  }
  return pieces.filter(
    (piece) =>
      piece.sizes.length === 0 ||
      !relevantByCategory.get(piece.category) ||
      piece.sizes.some((size) => requested.has(size)),
  );
}
