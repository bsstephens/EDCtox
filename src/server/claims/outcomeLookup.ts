import { claimNorm } from "./extract";

/**
 * Finds the outcome a claim is about.
 *
 * A third of what a model reads from a reproductive abstract is an outcome rather than a
 * mechanism, and until now those claims had nowhere to point. This is the outcome counterpart of
 * buildMechanismLookup, with one difference that matters: outcome names carry a direction.
 *
 * The ontology holds "Reduced sperm count", not "sperm count". A claim that sperm count went
 * *up* must not attach to it, so a bare entity key is registered only alongside the direction
 * its outcome asserts, and only when exactly one outcome claims that entity and direction.
 * "Delayed puberty" and "Early puberty" share an entity with opposite senses, so neither lends
 * its bare name to anything: those map only on their full name.
 *
 * Everything here is exact matching on keys built from the ontology itself. A term the ontology
 * does not hold stays unmapped, which is how a genuine gap stays visible.
 */

export type OutcomeNameRow = { code: string; name: string };

/** Up, down, or neither, from the claim's relation. */
export type ClaimDirection = "up" | "down" | "other";

export type OutcomeLookup = {
  /** The code, or null when the ontology holds nothing for this term in this direction. */
  find: (objectText: string, direction: ClaimDirection) => string | null;
};

/**
 * Direction words that begin an outcome name and have an unambiguous sense. "Delayed", "early"
 * and "altered" are deliberately absent: a delay is not a decrease, and "altered" asserts no
 * direction at all, so stripping them would invent a claim the ontology does not make.
 */
const DIRECTION_WORDS: ReadonlyArray<[string, ClaimDirection]> = [
  ["reduced", "down"],
  ["impaired", "down"],
  ["low", "down"],
  ["decreased", "down"],
  ["increased", "up"],
  ["elevated", "up"],
];

function splitDirection(name: string): { direction: ClaimDirection; entity: string } | null {
  const norm = claimNorm(name);
  for (const [word, direction] of DIRECTION_WORDS) {
    if (norm.startsWith(`${word} `)) {
      const entity = norm.slice(word.length + 1).trim();
      if (entity) return { direction, entity };
    }
  }
  // A trailing "gain" reads as an increase in the thing before it: "Weight gain".
  if (norm.endsWith(" gain")) {
    const entity = norm.slice(0, -" gain".length).trim();
    if (entity) return { direction: "up", entity };
  }
  return null;
}

export function buildOutcomeLookup(rows: readonly OutcomeNameRow[]): OutcomeLookup {
  // Keys that hold whatever the direction of the claim: the outcome's own code and full name.
  const byName = new Map<string, string>();
  const add = (key: string, code: string) => {
    const norm = claimNorm(key);
    if (norm && !byName.has(norm)) byName.set(norm, code);
  };
  for (const row of rows) add(row.code, row.code);
  for (const row of rows) add(row.name, row.code);
  for (const row of rows) add(row.code.replace(/_/g, " "), row.code);

  // Keys that hold only in the direction the outcome asserts, and only when unambiguous.
  const claimants = new Map<string, Set<string>>();
  for (const row of rows) {
    const split = splitDirection(row.name);
    if (!split) continue;
    const key = `${split.direction}|${split.entity}`;
    const set = claimants.get(key) ?? new Set<string>();
    set.add(row.code);
    claimants.set(key, set);
  }
  const directional = new Map<string, string>();
  for (const [key, codes] of claimants) {
    // Two outcomes asserting the same entity and direction cannot be told apart from an entity
    // name, so neither is offered.
    if (codes.size === 1) {
      const [only] = codes;
      if (only) directional.set(key, only);
    }
  }

  return {
    find(objectText: string, direction: ClaimDirection): string | null {
      const norm = claimNorm(objectText);
      if (!norm) return null;
      const exact = byName.get(norm);
      if (exact) return exact;
      if (direction === "other") return null;
      return directional.get(`${direction}|${norm}`) ?? null;
    },
  };
}

const UP = ["INCREASES", "ACTIVATES", "ENHANCES", "AGONIZES"];
const DOWN = ["DECREASES", "INHIBITS", "IMPAIRS", "ANTAGONIZES"];

/**
 * The direction a relation asserts. CONTRIBUTES_TO and ASSOCIATED_WITH read as "up" against an
 * outcome: a claim that an exposure contributes to reduced sperm count is a claim that the
 * reduction happens, not that sperm count rose. NO_EFFECT asserts no direction and maps only on
 * a full outcome name, so a reported absence of effect is never filed as the effect.
 */
export function claimDirection(relation: string): ClaimDirection {
  if (relation === "NO_EFFECT") return "other";
  if (relation === "CONTRIBUTES_TO" || relation === "ASSOCIATED_WITH") return "up";
  if (UP.some((word) => relation.includes(word))) return "up";
  if (DOWN.some((word) => relation.includes(word))) return "down";
  return "other";
}
