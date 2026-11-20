import { claimNorm } from "./extract";

/**
 * Finds the ontology code for the thing a claim is about.
 *
 * The first real extraction run mapped 5 of 44 claims, against 7 of 17 for the rule-based
 * extractor it replaced. The reason was not that the model was wrong: it names things the way a
 * paper does, and a paper writes CYP19A1 where the ontology writes "Aromatase (CYP19A1)", and
 * HSD3B1 where the ontology holds the enzyme family 3β-HSD.
 *
 * Everything here is still exact matching on a key built from the ontology itself. Nothing is
 * fuzzy, nothing is a nearest neighbour, and a term the ontology does not hold stays unmapped,
 * which is how a genuine gap stays visible.
 */

export type MechanismNameRow = { code: string; name: string };

export type MechanismLookup = {
  /** The code, or null when the ontology holds nothing for this term. */
  find: (objectText: string) => string | null;
  /** Terms that resolved only by dropping an isoform digit, for reporting. */
  isoformMatches: () => ReadonlyMap<string, string>;
};

/** "Aromatase (CYP19A1)" also answers to CYP19A1; "GLP-1 signalling" does not answer to 1. */
function parentheticals(name: string): string[] {
  return [...name.matchAll(/\(([^)]+)\)/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((token) => token.length > 1 && /[a-z]/i.test(token));
}

export function buildMechanismLookup(rows: readonly MechanismNameRow[]): MechanismLookup {
  const exact = new Map<string, string>();
  const add = (key: string, code: string) => {
    const norm = claimNorm(key);
    // First writer wins, so a node's own code and name beat a parenthetical borrowed from another.
    if (norm && !exact.has(norm)) exact.set(norm, code);
  };

  for (const row of rows) add(row.code, row.code);
  for (const row of rows) add(row.name, row.code);
  for (const row of rows) add(row.code.replace(/_/g, " "), row.code);
  // "Aromatase (CYP19A1)" should answer to "aromatase" as well as to the whole string, because a
  // paper writes one or the other and rarely both.
  for (const row of rows) {
    const withoutParens = row.name.replace(/\([^)]*\)/g, " ").trim();
    if (withoutParens && withoutParens !== row.name) add(withoutParens, row.code);
  }
  for (const row of rows) for (const token of parentheticals(row.name)) add(token, row.code);

  const isoforms = new Map<string, string>();

  return {
    find(objectText: string): string | null {
      const norm = claimNorm(objectText);
      if (!norm) return null;
      const direct = exact.get(norm);
      if (direct) return direct;

      // A gene symbol naming an isoform, where the ontology holds the family: HSD3B1 against
      // HSD3B. Only fires when dropping the final digit lands on a code the ontology already
      // has, so it cannot invent a node. The claim is still stored as a candidate for a curator,
      // never as verified, because a family is not the isoform the paper measured.
      const trimmed = norm.replace(/\d$/, "");
      if (trimmed !== norm && trimmed.length > 2) {
        const family = exact.get(trimmed);
        if (family) {
          isoforms.set(objectText, family);
          return family;
        }
      }
      return null;
    },
    isoformMatches: () => isoforms,
  };
}
