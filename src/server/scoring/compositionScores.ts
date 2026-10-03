/**
 * Diversity, composition, and generic dysbiosis stay descriptive.
 * A signed score is allowed only when the assessment explicitly says a quantitative score is supported.
 */
export function descriptiveScoreError(input: {
  quantitativeScoreByDefault: boolean;
  effectScore: number | null;
  quantitativeScoreSupported?: boolean;
}): string | null {
  if (input.quantitativeScoreByDefault) return null;
  if (input.effectScore !== null && input.quantitativeScoreSupported !== true) {
    return "A diversity, composition, or dysbiosis change stays descriptive unless a functional or adverse consequence is explicitly supported.";
  }
  return null;
}
