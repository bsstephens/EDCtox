import { claimNorm } from "./extract";

/**
 * Resolves which preparation a claim's result came from.
 *
 * A 2017 paper found that glyphosate alone had no effect on bovine granulosa cell estradiol
 * while the Roundup formulation dramatically decreased it. Both readings were correct and both
 * were filed against glyphosate, because a claim had no way to say which arm produced it -- the
 * exact distinction the NIEHS review turns on, and one the ontology already models with two
 * records.
 *
 * The candidate set is closed and small: the compound the run asked about, the formulations it
 * is an active ingredient of, what those formulations contain, its metabolites and its parent.
 * Nothing else, which is what keeps this exact rather than a search over every compound.
 *
 * That closure also makes an otherwise dangerous match safe. AMPA deliberately has no "AMPA"
 * alias, because in the neuroscience literature that abbreviation is a glutamate receptor
 * agonist. Inside the arms of a glyphosate study there is no such ambiguity, so the display
 * name is matched here even though routing will not match it anywhere else.
 */

export type ArmCandidate = {
  compoundId: string;
  slug: string;
  canonicalName: string;
  displayName: string;
  aliases: readonly string[];
  /** FORMULATION marks the shell that holds product evidence. */
  recordKind: string;
};

/**
 * Words that say an arm was a product rather than the pure substance.
 *
 * This list exists because of a real failure. The model read the 2017 paper's arms perfectly --
 * "glyphosate alone" and "glyphosate-Roundup" -- and both resolved to glyphosate, because
 * "glyphosate-Roundup" contains the key "glyphosate". A formulation arm filed as the active
 * ingredient is the exact error per-arm claims were built to prevent, so a phrase carrying one
 * of these words may not resolve to the pure compound at all.
 *
 * Brand names belong here rather than on the formulation record. The record's own seed note says
 * no commercial brand is named on it, and that is right: the NIEHS review points out that GBH
 * composition is confidential, varies by region and has changed over time, sometimes with
 * chemically different products sold under one brand. "Roundup" is therefore not a chemical
 * identity. It is evidence that the arm was a formulation, which is what this list reads it as,
 * while machineArmText keeps the brand the paper actually named.
 */
const FORMULATION_MARKERS = [
  "roundup",
  "formulation",
  "formulations",
  "formulated",
  "commercial",
  "product",
  "herbicide",
  "herbicides",
  "mixture",
  "glyfonova",
] as const;

export type ArmLookup = {
  /** The compound dosed, or null when the phrase names nothing in the candidate set. */
  find: (armText: string) => string | null;
  /** Phrases the model offered that matched nothing, for reporting. */
  unresolved: () => ReadonlyMap<string, number>;
};

/**
 * Longest first, so "glyphosate-based herbicide" wins over "glyphosate" on a phrase that
 * contains both. Otherwise every formulation arm would resolve to the active ingredient, which
 * is the error this whole mechanism exists to prevent.
 */
function keysFor(candidate: ArmCandidate): string[] {
  const terms = [candidate.canonicalName, candidate.displayName, ...candidate.aliases];
  return [...new Set(terms.map((term) => claimNorm(term)).filter(Boolean))];
}

export function buildArmLookup(candidates: readonly ArmCandidate[]): ArmLookup {
  const entries: Array<{ key: string; compoundId: string }> = [];
  for (const candidate of candidates) {
    for (const key of keysFor(candidate)) entries.push({ key, compoundId: candidate.compoundId });
  }
  entries.sort((a, b) => b.key.length - a.key.length);
  const unresolved = new Map<string, number>();

  return {
    find(armText: string): string | null {
      const text = claimNorm(armText);
      if (!text) return null;
      const padded = ` ${text} `;

      // A phrase that says "product" cannot be the pure substance, whatever else it contains.
      // Within a closed candidate set this is safe: a formulation arm in a glyphosate study is
      // a glyphosate formulation, so the one shell in the set is the answer. Two shells would be
      // ambiguous and are left for a curator rather than guessed between.
      if (FORMULATION_MARKERS.some((word) => padded.includes(` ${word} `) || text.includes(word))) {
        const shells = candidates.filter((candidate) => candidate.recordKind === "FORMULATION");
        const shell = shells.length === 1 ? shells[0] : undefined;
        if (shell) return shell.compoundId;
        unresolved.set(armText, (unresolved.get(armText) ?? 0) + 1);
        return null;
      }

      // Exact first, then containment, both longest key first. An arm is written as a bare name
      // or as a short phrase ("glyphosate alone"), so containment is needed; it is still an
      // exact match of a known name inside the phrase, not a similarity score.
      const exact = entries.find((entry) => entry.key === text);
      if (exact) return exact.compoundId;
      const contained = entries.find((entry) => text.includes(entry.key));
      if (contained) return contained.compoundId;
      unresolved.set(armText, (unresolved.get(armText) ?? 0) + 1);
      return null;
    },
    unresolved: () => unresolved,
  };
}
