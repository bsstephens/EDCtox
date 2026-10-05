import { createHash } from "node:crypto";

import { normalizeTitle } from "../literature/dedup";
import { MITOCHONDRIAL_MECHANISM_CODES } from "./constants";

export type MechanismCatalog = Readonly<Record<string, { id: string; scorePolicy: string }>>;

export type ClaimDraft = {
  subjectType: "CHEMICAL";
  subjectText: "bisphenol A";
  relation:
    | "BINDS"
    | "AGONIZES"
    | "ANTAGONIZES"
    | "INHIBITS"
    | "ACTIVATES"
    | "INCREASES_EXPRESSION"
    | "DECREASES_EXPRESSION"
    | "INCREASES_LEVEL"
    | "DECREASES_LEVEL"
    | "IMPAIRS_FUNCTION"
    | "ENHANCES_FUNCTION"
    | "CONTRIBUTES_TO"
    | "ASSOCIATED_WITH"
    | "NO_EFFECT"
    | "OTHER";
  objectType:
    | "CHEMICAL"
    | "RECEPTOR"
    | "ENZYME"
    | "GENE"
    | "PROTEIN"
    | "BIOMARKER"
    | "CELL"
    | "TISSUE"
    | "ORGAN"
    | "PHYSIOLOGICAL_PROCESS"
    | "CELLULAR_PROCESS"
    | "PHENOTYPE"
    | "OUTCOME"
    | "OTHER";
  objectText: string;
  machineDirectness: "DIRECTLY_DEMONSTRATED" | "STRONGLY_SUPPORTED" | "CONSISTENT_WITH" | "INFERRED" | "HYPOTHESIZED" | "UNKNOWN";
  machineConfidence: "LOW" | "MODERATE" | "HIGH";
  machineRationale: string;
  machineMappingState: "UNMAPPED" | "CANDIDATE";
  mechanismCode: string | null;
  mechanismId: string | null;
  speciesText: string | null;
  tissueText: string | null;
  cellTypeText: string | null;
  doseText: string | null;
  measureType: string | null;
  measureValue: string | null;
  measureUnit: string | null;
  textOrigin: "ABSTRACT";
  sourceSection: "Abstract" | "Title";
  quotedSupport: string | null;
  reviewPriority: "AUTO_ACCEPT_LOW_RISK" | "REVIEW_RECOMMENDED" | "REVIEW_REQUIRED";
  reviewDerived: boolean;
};

const MITO = new Set<string>(MITOCHONDRIAL_MECHANISM_CODES);

type Kind = "measured" | "process" | "interpretive";

type Rule = {
  accept: (norm: string) => boolean;
  relation: ClaimDraft["relation"];
  objectText: string;
  objectType: ClaimDraft["objectType"];
  mechanismCode: string | null;
  kind: Kind;
  extra: string;
};

const RULES: Rule[] = [
  {
    accept: (norm) => /reduced concentrations of estradiol|decreased estradiol|decreased e2\b|reduced estradiol/.test(norm),
    relation: "DECREASES_LEVEL",
    objectText: "estradiol",
    objectType: "BIOMARKER",
    mechanismCode: null,
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => /reduced concentrations of estradiol and progesterone|decreased progesterone|reduced progesterone|decreased e2 p4/.test(norm),
    relation: "DECREASES_LEVEL",
    objectText: "progesterone",
    objectType: "BIOMARKER",
    mechanismCode: null,
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => /decreased testosterone|reduced testosterone/.test(norm),
    relation: "DECREASES_LEVEL",
    objectText: "testosterone",
    objectType: "BIOMARKER",
    mechanismCode: null,
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => /reduced expression of steroidogenic enzymes|decreased expression of steroidogenic enzymes/.test(norm),
    relation: "DECREASES_EXPRESSION",
    objectText: "steroidogenic enzymes",
    objectType: "ENZYME",
    mechanismCode: null,
    kind: "measured",
    extra: " The enzyme class is not mapped to one mechanism.",
  },
  {
    accept: (norm) => /disrupts steroidogenesis|impaired spermatogenesis and steroidogenesis|suppressed steroidogenesis|alters steroid hormone biosynthesis/.test(norm),
    relation: "IMPAIRS_FUNCTION",
    objectText: "steroidogenesis",
    objectType: "PHYSIOLOGICAL_PROCESS",
    mechanismCode: null,
    kind: "process",
    extra: " Steroidogenesis is not mapped to a grouping parent.",
  },
  {
    accept: (norm) => norm.includes("impaired spermatogenesis"),
    relation: "IMPAIRS_FUNCTION",
    objectText: "spermatogenesis",
    objectType: "PHYSIOLOGICAL_PROCESS",
    mechanismCode: "SPERMATOGENESIS",
    kind: "process",
    extra: "",
  },
  {
    accept: (norm) => /increased er alpha|increased estrogen receptor alpha/.test(norm),
    relation: "INCREASES_LEVEL",
    objectText: "estrogen receptor alpha",
    objectType: "RECEPTOR",
    mechanismCode: null,
    kind: "measured",
    extra: " A change in receptor level is not recorded as receptor agonism.",
  },
  {
    accept: (norm) => norm.includes("cyp19a1") && /elevated|increased|upregulated/.test(norm),
    relation: "INCREASES_EXPRESSION",
    objectText: "aromatase (CYP19A1)",
    objectType: "ENZYME",
    mechanismCode: "AROMATASE_CYP19A1",
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => norm.includes("hsd3b") && /increased the expression|upregulated the expression|increased expression/.test(norm),
    relation: "INCREASES_EXPRESSION",
    objectText: "3β-HSD",
    objectType: "ENZYME",
    mechanismCode: "HSD3B",
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => norm.includes("increased the expression of androgen receptor"),
    relation: "INCREASES_EXPRESSION",
    objectText: "androgen receptor",
    objectType: "RECEPTOR",
    mechanismCode: null,
    kind: "measured",
    extra: " Higher expression is not recorded as androgen-receptor agonism.",
  },
  {
    accept: (norm) => /\b(increased|upregulated) the expression of ar\b/.test(norm) && !norm.includes("androgen receptor"),
    relation: "INCREASES_EXPRESSION",
    objectText: "AR",
    objectType: "GENE",
    mechanismCode: null,
    kind: "measured",
    extra: " The abbreviation AR is left as printed and is not recorded as androgen-receptor agonism.",
  },
  {
    accept: (norm) => /disruption of star\b/.test(norm),
    relation: "IMPAIRS_FUNCTION",
    objectText: "StAR",
    objectType: "PROTEIN",
    mechanismCode: "STAR",
    kind: "interpretive",
    extra: "",
  },
  {
    accept: (norm) => /cyp450scc|cyp11a1/.test(norm) && /disruption|inhibit|decreas|reduc/.test(norm),
    relation: "IMPAIRS_FUNCTION",
    objectText: "CYP11A1",
    objectType: "ENZYME",
    mechanismCode: "CYP11A1",
    kind: "interpretive",
    extra: "",
  },
  {
    accept: (norm) => /hsd 3 beta|3 beta hsd/.test(norm) && norm.includes("disruption"),
    relation: "IMPAIRS_FUNCTION",
    objectText: "3β-HSD",
    objectType: "ENZYME",
    mechanismCode: "HSD3B",
    kind: "interpretive",
    extra: "",
  },
  {
    accept: (norm) => norm.includes("aromatase") && norm.includes("inhibit") && !/no effect|did not|does not|not inhibit/.test(norm),
    relation: "INHIBITS",
    objectText: "aromatase",
    objectType: "ENZYME",
    mechanismCode: "AROMATASE_CYP19A1",
    kind: "measured",
    extra: "",
  },
  {
    accept: (norm) => norm.includes("aromatase") && /disruption|reduces|reduced/.test(norm) && !norm.includes("inhibit") && !norm.includes("no effect"),
    relation: "IMPAIRS_FUNCTION",
    objectText: "aromatase",
    objectType: "ENZYME",
    mechanismCode: "AROMATASE_CYP19A1",
    kind: "interpretive",
    extra: " Disruption of activity is not recorded as a direct inhibition assay.",
  },
  {
    accept: (norm) => /no effect on aromatase|did not affect aromatase|did not alter aromatase|did not change aromatase/.test(norm),
    relation: "NO_EFFECT",
    objectText: "aromatase",
    objectType: "ENZYME",
    mechanismCode: "AROMATASE_CYP19A1",
    kind: "measured",
    extra: " A no-effect statement stays a separate claim.",
  },
  {
    accept: (norm) => norm.includes("affinity for estrogen receptors"),
    relation: "BINDS",
    objectText: "estrogen receptor",
    objectType: "RECEPTOR",
    mechanismCode: null,
    kind: "interpretive",
    extra: " Reported affinity is not recorded as estrogen-receptor agonism.",
  },
  {
    accept: (norm) => /reduces endogenous estrogen|reduced endogenous estrogen/.test(norm),
    relation: "DECREASES_LEVEL",
    objectText: "endogenous estrogen synthesis",
    objectType: "BIOMARKER",
    mechanismCode: null,
    kind: "interpretive",
    extra: "",
  },
  {
    accept: (norm) => /decreased cellular atp|reduced cellular atp|decreased atp|reduced atp|lower atp/.test(norm) && !/complex i\b|complex ii\b|oxygen consumption|membrane potential/.test(norm),
    relation: "DECREASES_LEVEL",
    objectText: "ATP",
    objectType: "BIOMARKER",
    mechanismCode: null,
    kind: "measured",
    extra: " A cellular ATP change is not mapped to electron transport or ATP production.",
  },
  {
    accept: (norm) => norm.includes("lactate dehydrogenase") && /inhibit|decreas|reduc/.test(norm),
    relation: "INHIBITS",
    objectText: "lactate dehydrogenase",
    objectType: "ENZYME",
    mechanismCode: null,
    kind: "measured",
    extra: " Lactate dehydrogenase is left unmapped when no local mechanism exists.",
  },
];

export function claimNorm(value: string): string {
  return normalizeTitle(value.replace(/α/g, " alpha ").replace(/β/g, " beta "));
}

export function claimStableKey(evidenceSourceId: string, subjectText: string, relation: string, objectText: string): string {
  const hash = createHash("sha256")
    .update(`${evidenceSourceId}|${claimNorm(subjectText)}|${relation}|${claimNorm(objectText)}`)
    .digest("hex")
    .slice(0, 24);
  return `claim:${hash}`;
}

/** Bare TFA is not trifluoroacetic acid. This slice does not search or extract TFA. */
export function acronymIsSpecific(token: string, text: string): boolean {
  if (token.toLowerCase() !== "tfa") return true;
  return /trifluoroacetic|trifluoroacetate/.test(text.toLowerCase());
}

export function catalogFromRows(rows: readonly { id: string; code: string; scorePolicy: string }[]): MechanismCatalog {
  const catalog: Record<string, { id: string; scorePolicy: string }> = {};
  for (const row of rows) catalog[row.code] = { id: row.id, scorePolicy: row.scorePolicy };
  return catalog;
}

export function resolveMechanismCode(
  code: string | null,
  objectText: string,
  catalog: MechanismCatalog,
): { mechanismId: string | null; mappingState: "UNMAPPED" | "CANDIDATE"; mechanismCode: string | null } {
  const objectNorm = claimNorm(objectText);
  const atpOnly = /\batp\b/.test(objectNorm) && !/complex|oxygen consumption|membrane potential|respiratory|\bocr\b/.test(objectNorm);
  if (!code || atpOnly || MITO.has(code)) return { mechanismId: null, mappingState: "UNMAPPED", mechanismCode: null };
  const entry = catalog[code];
  if (!entry || entry.scorePolicy === "GROUPING_ONLY") return { mechanismId: null, mappingState: "UNMAPPED", mechanismCode: null };
  return { mechanismId: entry.id, mappingState: "CANDIDATE", mechanismCode: code };
}

function sentences(value: string): string[] {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function clip(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 497)}...` : trimmed;
}

function findSentence(title: string, abstract: string): (accept: (norm: string) => boolean) => { text: string; section: "Abstract" | "Title" } | null {
  const abstractSentences = sentences(abstract);
  const titleSentences = sentences(title);
  return (accept) => {
    const fromAbstract = abstractSentences.find((sentence) => accept(claimNorm(sentence)));
    if (fromAbstract) return { text: clip(fromAbstract), section: "Abstract" };
    const fromTitle = titleSentences.find((sentence) => accept(claimNorm(sentence))) ?? (accept(claimNorm(title)) ? title : null);
    if (fromTitle) return { text: clip(fromTitle), section: "Title" };
    return null;
  };
}

function namesBpa(text: string): boolean {
  const norm = claimNorm(text);
  return norm.includes("bisphenol a") || /\bbpa\b/.test(norm);
}

function titleIsOtherBisphenol(title: string): boolean {
  const norm = claimNorm(title);
  if (norm.includes("bisphenol a") || /\bbpa\b/.test(norm)) return false;
  return /\bbisphenol [bcdfgs]\b|\bbisphenol af\b|\bbps\b|\bbpf\b|\bbpaf\b|\bbpb\b/.test(norm);
}

function reviewDerived(title: string, abstract: string): boolean {
  return /systematic review|meta analysis|narrative review|critical review|scoping review|this review|we reviewed|experimental literature/.test(
    claimNorm(`${title} ${abstract}`),
  );
}

function directnessFor(review: boolean, sentence: string, kind: Kind): ClaimDraft["machineDirectness"] {
  const norm = claimNorm(sentence);
  const hedged = /\b(may|might|potential|hypothesized|hypothesised)\b/.test(norm);
  const firm = /\b(decreased|increased|reduced|elevated|inhibited|significant)\b/.test(norm);
  if (!review && /enzyme kinetics|receptor binding assay|\bic50\b|\bknockout\b|rescue experiment/.test(norm)) return "DIRECTLY_DEMONSTRATED";
  if (review) return hedged && !firm ? "HYPOTHESIZED" : "INFERRED";
  if (hedged && !firm) return "HYPOTHESIZED";
  if (kind === "measured") return "STRONGLY_SUPPORTED";
  return "CONSISTENT_WITH";
}

function confidenceFor(review: boolean, directness: ClaimDraft["machineDirectness"]): ClaimDraft["machineConfidence"] {
  if (directness === "HYPOTHESIZED") return "LOW";
  if (review) return "MODERATE";
  if (directness === "STRONGLY_SUPPORTED" || directness === "DIRECTLY_DEMONSTRATED") return "HIGH";
  return "MODERATE";
}

function priorityFor(review: boolean, mappingState: ClaimDraft["machineMappingState"], relation: ClaimDraft["relation"]): ClaimDraft["reviewPriority"] {
  if (review || mappingState === "CANDIDATE" || relation === "NO_EFFECT") return "REVIEW_REQUIRED";
  if (relation === "IMPAIRS_FUNCTION" || relation === "BINDS" || relation === "CONTRIBUTES_TO") return "REVIEW_RECOMMENDED";
  return "AUTO_ACCEPT_LOW_RISK";
}

function listed(text: string, checks: ReadonlyArray<readonly [RegExp, string]>): string | null {
  const found: string[] = [];
  for (const [pattern, label] of checks) {
    if (pattern.test(text) && !found.includes(label)) found.push(label);
  }
  return found.length > 0 ? found.join("; ") : null;
}

function documentContext(title: string, abstract: string): Pick<ClaimDraft, "speciesText" | "tissueText" | "cellTypeText" | "doseText"> {
  const norm = claimNorm(`${title} ${abstract}`);
  const doses = [...abstract.matchAll(/\d+(?:\.\d+)?\s*(?:µM|μM|uM|nM|mg\/kg|μg\/kg|µg\/kg)/gi)].slice(0, 3).map((match) => match[0]);
  return {
    speciesText: listed(norm, [
      [/\b(human|humans|women|patients)\b/, "human"],
      [/\b(mouse|mice)\b/, "mouse"],
      [/\brats?\b/, "rat"],
    ]),
    tissueText: listed(norm, [
      [/\b(ovary|ovaries|ovarian)\b/, "ovary"],
      [/\b(testis|testes|testicular)\b/, "testis"],
      [/\b(brain|hypothalam\w*|amygdal\w*|arcuate)\b/, "brain"],
    ]),
    cellTypeText: listed(norm, [
      [/granulosa/, "granulosa"],
      [/leydig/, "Leydig"],
      [/theca/, "theca"],
      [/endometrial stromal/, "endometrial stromal"],
    ]),
    doseText: doses.length > 0 ? doses.join(", ") : null,
  };
}

function measureFrom(sentence: string): Pick<ClaimDraft, "measureType" | "measureValue" | "measureUnit"> {
  const match = /IC50 of ([0-9]+(?:\.[0-9]+)?)[\s]*([µμu]M|nM)/i.exec(sentence);
  const value = match?.[1];
  const unit = match?.[2];
  if (!value || !unit) return { measureType: null, measureValue: null, measureUnit: null };
  return { measureType: "IC50", measureValue: value, measureUnit: unit };
}

export function extractMechanisticClaims(input: { title: string; abstractText: string | null; catalog: MechanismCatalog }): ClaimDraft[] {
  const abstract = input.abstractText ?? "";
  const document = `${input.title} ${abstract}`;
  if (!namesBpa(document) || titleIsOtherBisphenol(input.title)) return [];
  const review = reviewDerived(input.title, abstract);
  const locate = findSentence(input.title, abstract);
  const context = documentContext(input.title, abstract);
  const drafts: ClaimDraft[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const located = locate(rule.accept);
    if (!located) continue;
    const key = `${rule.relation}|${claimNorm(rule.objectText)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = resolveMechanismCode(rule.mechanismCode, rule.objectText, input.catalog);
    const machineDirectness = directnessFor(review, located.text, rule.kind);
    const where = located.section === "Title" ? "The title" : "The abstract";
    const ceiling = review
      ? " Review text stays inferred or hypothesized."
      : " Abstract text is not treated as directly demonstrated unless the sentence reports a direct assay.";
    drafts.push({
      subjectType: "CHEMICAL",
      subjectText: "bisphenol A",
      relation: rule.relation,
      objectType: rule.objectType,
      objectText: rule.objectText,
      machineDirectness,
      machineConfidence: confidenceFor(review, machineDirectness),
      machineRationale: `${where} supports this ${rule.relation} ${rule.objectText} edge.${rule.extra}${ceiling}`.slice(0, 400),
      machineMappingState: resolved.mappingState,
      mechanismCode: resolved.mechanismCode,
      mechanismId: resolved.mechanismId,
      ...context,
      ...measureFrom(located.text),
      textOrigin: "ABSTRACT",
      sourceSection: located.section,
      quotedSupport: located.text,
      reviewPriority: priorityFor(review, resolved.mappingState, rule.relation),
      reviewDerived: review,
    });
  }

  return drafts;
}
