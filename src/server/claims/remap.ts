import { resolveMechanismCode, type MechanismCatalog } from "./extract";
import { buildMechanismLookup, type MechanismNameRow } from "./mechanismLookup";
import { buildOutcomeLookup, claimDirection, type OutcomeNameRow } from "./outcomeLookup";
import { buildSynonymResolver } from "./synonyms";

/**
 * Re-resolves where a stored claim points, without reading the paper again.
 *
 * An ontology row or a curated synonym changes what a claim should map to, and none of that
 * changes what the paper said. Re-reading 52 papers to pick up a vocabulary change would cost
 * money, and worse, it would return slightly different claims: two readings of one abstract
 * agree on 74% to 86% of findings, so a re-read churns rows that a remap leaves alone.
 *
 * This is the whole of the mapping decision in one place, and it is deliberately pure: given a
 * claim's object text and relation, it says which node the current ontology and synonym table
 * put it at. Order matters -- a synonym is a curator's decision and wins over a key built from
 * the ontology, and a mechanism wins over an outcome, because a claim points at one or the other.
 */

export type RemapInput = {
  objectText: string;
  /** What the extractor mapped on, where the row records it. */
  objectHead: string | null;
  relation: string;
  mechanismCode: string | null;
  outcomeCode: string | null;
};

/** Never VERIFIED: that state is a curator's, and a machine remap cannot reach it. */
export type MachineMappingState = "CANDIDATE" | "UNMAPPED";

export type RemapResult = {
  mechanismCode: string | null;
  outcomeCode: string | null;
  mappingState: MachineMappingState;
  changed: boolean;
};

export function buildRemapper(input: {
  mechanisms: readonly MechanismNameRow[];
  outcomes: readonly OutcomeNameRow[];
  catalog: MechanismCatalog;
}) {
  const mechanisms = buildMechanismLookup(input.mechanisms);
  const outcomes = buildOutcomeLookup(input.outcomes);
  const synonyms = buildSynonymResolver();
  const outcomeCodes = new Set(input.outcomes.map((row) => row.code));

  return function remap(claim: RemapInput): RemapResult {
    // The head is what the extractor mapped on, so it is tried first where the row records it.
    // Rows written before that column existed have only the verbatim text.
    const terms = [claim.objectHead, claim.objectText].filter((value): value is string => Boolean(value));
    const synonym = terms.map((term) => synonyms.find(term, claim.relation)).find(Boolean) ?? null;

    let mechanismCode: string | null = null;
    let outcomeCode: string | null = null;

    if (synonym?.kind === "mechanism") {
      // Still through the mechanism guards: a synonym may not promote a grouping node into a
      // claim target, and a code the ontology has since dropped must not be written.
      mechanismCode = resolveMechanismCode(synonym.code, claim.objectText, input.catalog).mechanismCode;
    } else if (synonym?.kind === "outcome") {
      outcomeCode = outcomeCodes.has(synonym.code) ? synonym.code : null;
    }

    if (!mechanismCode && !outcomeCode) {
      const fromOntology = terms.map((term) => mechanisms.find(term)).find(Boolean) ?? null;
      mechanismCode = resolveMechanismCode(fromOntology, claim.objectText, input.catalog).mechanismCode;
    }
    if (!mechanismCode && !outcomeCode) {
      const direction = claimDirection(claim.relation);
      outcomeCode = terms.map((term) => outcomes.find(term, direction)).find(Boolean) ?? null;
    }

    /**
     * A remap never clears a mapping. It applies a vocabulary change to claims it can resolve;
     * a claim it cannot resolve is one it knows nothing new about, not one that has been
     * disproved. Fifteen good mappings would have been cleared on the first run of this,
     * because they were made from an object head that rows written before the column existed
     * do not record. Removing a mapping stays a curator action, or the result of re-reading the
     * paper, where there is a fresh reading to justify it.
     */
    if (!mechanismCode && !outcomeCode && (claim.mechanismCode ?? claim.outcomeCode)) {
      return {
        mechanismCode: claim.mechanismCode,
        outcomeCode: claim.outcomeCode,
        mappingState: "CANDIDATE",
        changed: false,
      };
    }

    const mappingState: MachineMappingState = mechanismCode || outcomeCode ? "CANDIDATE" : "UNMAPPED";
    return {
      mechanismCode,
      outcomeCode,
      mappingState,
      changed: mechanismCode !== claim.mechanismCode || outcomeCode !== claim.outcomeCode,
    };
  };
}
