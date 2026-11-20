export const PROFILE_LABELS = ["REP", "DEV", "NEUROENDO", "THY", "IMM", "MET", "MITO", "REDOX"] as const;

export type ProfileLabel = (typeof PROFILE_LABELS)[number];

export const DOMAIN_FULL_NAME: Record<ProfileLabel, string> = {
  REP: "Reproductive",
  DEV: "Developmental",
  NEUROENDO: "Neuroendocrine / HPA",
  THY: "Thyroid",
  IMM: "Immune",
  MET: "Metabolic",
  MITO: "Mitochondrial",
  REDOX: "Redox",
};

/// Which of the site's two tracks each profile column belongs to. Editorial labelling for readers.
/// It is not an input to any score and columns are never added across tracks, or within one.
export const DOMAIN_TRACK: Record<ProfileLabel, "ENDOCRINE_DISRUPTION" | "CELLULAR_BIOENERGETIC"> = {
  REP: "ENDOCRINE_DISRUPTION",
  DEV: "ENDOCRINE_DISRUPTION",
  NEUROENDO: "ENDOCRINE_DISRUPTION",
  THY: "ENDOCRINE_DISRUPTION",
  IMM: "ENDOCRINE_DISRUPTION",
  MET: "ENDOCRINE_DISRUPTION",
  MITO: "CELLULAR_BIOENERGETIC",
  REDOX: "CELLULAR_BIOENERGETIC",
};

export const TRACK_LABEL: Record<string, string> = {
  ENDOCRINE_DISRUPTION: "Endocrine disruption",
  CELLULAR_BIOENERGETIC: "Mitochondrial and redox",
  CONTEXTUAL: "Context",
};

export const HUMAN_LABEL: Record<string, string> = {
  H0: "H0 · no meaningful human evidence",
  H1: "H1 · mechanistic, cellular, or high-dose animal",
  H2: "H2 · strong experimental, limited human",
  H3: "H3 · substantial human observation plus biology",
  H4: "H4 · established at relevant human exposure",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  VERY_LOW: "Very low",
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very high",
};

export const DIRECTION_LABEL: Record<string, string> = {
  PROTECTIVE: "Protective or restorative signal",
  DISRUPTIVE: "Disruptive signal",
  PHYSIOLOGICAL: "Physiological activity",
  BIPHASIC: "Biphasic",
  CONTEXT_DEPENDENT: "Context-dependent",
  MIXED: "Mixed directions",
  UNKNOWN: "Direction uncertain",
};

export function evidenceWording(evidenceClass: string): string {
  switch (evidenceClass) {
    case "IN_VITRO":
    case "CELLULAR":
      return "Reported in vitro";
    case "EX_VIVO":
      return "Reported ex vivo";
    case "ANIMAL":
      return "Reported in animals";
    case "HUMAN_OBSERVATIONAL":
      return "Associated in observational human data";
    case "HUMAN_PROSPECTIVE":
      return "Associated in prospective human data";
    case "RANDOMIZED_TRIAL":
      return "Measured in a randomized trial";
    case "META_ANALYSIS":
      return "Summarised in a meta-analysis";
    case "SYSTEMATIC_REVIEW":
      return "Summarised in a systematic review";
    case "REGULATORY_ASSESSMENT":
      return "Stated in a regulatory assessment";
    case "MECHANISTIC_REVIEW":
      return "Discussed as a mechanism";
    default:
      return "Reported";
  }
}

export function signedScore(score: number | null): string {
  if (score === null) return "—";
  if (score > 0) return `+${score}`;
  return String(score);
}

/**
 * Wording for a domain that holds assessments and still has no headline number. A dash is
 * reserved for a domain nobody has assessed, so the two never look alike.
 */
export const UNSCORED_LABEL: Record<string, { short: string; long: string }> = {
  PHYSIOLOGICAL: {
    short: "Phys.",
    long: "Assessed. Activity is physiological and is deliberately not scored as disruption.",
  },
  NO_NUMBER_JUSTIFIED: {
    short: "n/s",
    long: "Assessed. No quantitative score was justified, so none is stored.",
  },
  OUTSIDE_HEADLINE: {
    short: "n/s",
    long: "Assessed on research-only mechanisms, which never enter a headline.",
  },
};

export const NEVER_ASSESSED_LABEL =
  "Not assessed. No mechanism assessment is stored for this domain. That is an absence of work, not evidence of no effect.";

/** Tone for a domain nobody has assessed. Dashed, so emptiness reads as missing, not as zero. */
export const NEVER_ASSESSED_TONE = "border border-dashed border-stone-300 text-stone-400";

/** Tone for a domain that was assessed and deliberately carries no number. */
export const UNSCORED_TONE = "bg-stone-100 text-stone-600 ring-stone-300";

export function scoreTone(score: number | null, physiological: boolean): string {
  if (physiological && score === null) {
    return "bg-indigo-50 text-indigo-950 ring-indigo-200";
  }
  if (score === null) return "bg-zinc-50 text-zinc-400 ring-zinc-200";
  if (score <= -3) return "bg-teal-800 text-white ring-teal-900";
  if (score === -2) return "bg-teal-200 text-teal-950 ring-teal-300";
  if (score === -1) return "bg-teal-50 text-teal-950 ring-teal-200";
  if (score === 0) return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  if (score === 1) return "bg-amber-50 text-amber-950 ring-amber-200";
  if (score === 2) return "bg-orange-200 text-orange-950 ring-orange-300";
  if (score === 3) return "bg-orange-600 text-white ring-orange-700";
  return "bg-red-800 text-white ring-red-900";
}

export function prettyEnum(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

export function formatBiologicalContext(context: {
  organ: string | null;
  tissue: string | null;
  cellType: string | null;
  subcellularCompartment: string | null;
} | null): string | null {
  if (!context) return null;
  const parts = [context.organ, context.tissue, context.cellType, context.subcellularCompartment].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
