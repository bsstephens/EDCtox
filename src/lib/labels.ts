export const PROFILE_LABELS = ["REP", "DEV", "NEUROENDO", "IMM", "MET", "MITO", "REDOX"] as const;

export type ProfileLabel = (typeof PROFILE_LABELS)[number];

export const DOMAIN_FULL_NAME: Record<ProfileLabel, string> = {
  REP: "Reproductive",
  DEV: "Developmental",
  NEUROENDO: "Neuroendocrine / HPA",
  IMM: "Immune",
  MET: "Metabolic",
  MITO: "Mitochondrial",
  REDOX: "Redox",
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
