import { claimSynonyms, type ClaimSynonym } from "../../data/seeds/claimSynonyms";
import { claimNorm } from "./extract";
import { claimDirection } from "./outcomeLookup";

/**
 * Applies the curated synonyms from `src/data/seeds/claimSynonyms.ts`.
 *
 * This sits in front of the two ontology lookups and answers the same question they do: what
 * does this phrase name? The difference is only where the answer came from. The lookups build
 * their keys from the ontology itself, so they find a term the ontology already spells; this
 * finds a term a curator decided means the same thing. Both are exact: a phrase matches a
 * synonym or it does not, and nothing here measures similarity.
 *
 * A synonym can carry a direction, for a node whose name asserts one, and a relation list, for
 * a node that names an action rather than an entity -- agonising a receptor and changing how
 * much of it is present are different nodes, so one phrase reaches either depending on what the
 * claim says happened. Where both constraints are absent the synonym holds for any claim.
 */

export type SynonymMatch = { code: string; kind: "mechanism" | "outcome" };

export type SynonymResolver = {
  find: (objectText: string, relation: string) => SynonymMatch | null;
  /** Every code the table points at, so a caller can check they all exist. */
  codes: () => ReadonlyArray<SynonymMatch>;
};

function applies(entry: ClaimSynonym, relation: string): boolean {
  if (entry.relations && !entry.relations.includes(relation)) return false;
  if (entry.direction && claimDirection(relation) !== entry.direction) return false;
  return true;
}

export function buildSynonymResolver(entries: readonly ClaimSynonym[] = claimSynonyms): SynonymResolver {
  const byTerm = new Map<string, ClaimSynonym[]>();
  for (const entry of entries) {
    const key = claimNorm(entry.term);
    if (!key) continue;
    byTerm.set(key, [...(byTerm.get(key) ?? []), entry]);
  }

  return {
    find(objectText: string, relation: string): SynonymMatch | null {
      const key = claimNorm(objectText);
      if (!key) return null;
      const candidates = byTerm.get(key);
      if (!candidates) return null;
      // A constrained entry is preferred over an unconstrained one for the same phrase, so a
      // relation-specific decision is not shadowed by a catch-all.
      const constrained = candidates.filter((entry) => entry.relations ?? entry.direction);
      for (const entry of [...constrained, ...candidates.filter((entry) => !(entry.relations ?? entry.direction))]) {
        if (applies(entry, relation)) return { code: entry.code, kind: entry.kind };
      }
      return null;
    },
    codes: () => entries.map((entry) => ({ code: entry.code, kind: entry.kind })),
  };
}
