export type EffectDirectionName =
  | "PROTECTIVE"
  | "DISRUPTIVE"
  | "PHYSIOLOGICAL"
  | "BIPHASIC"
  | "CONTEXT_DEPENDENT"
  | "MIXED"
  | "UNKNOWN";

export type ReportedSex = "MALE" | "FEMALE" | "MIXED" | "NOT_APPLICABLE" | "UNSPECIFIED";

export type EffectRecord = {
  effectScore: number | null;
  effectDirection: string;
  quantitativeScoreSupported?: boolean;
};

/**
 * Signed score rules. UNKNOWN may keep a score. PHYSIOLOGICAL may not.
 * Protective scores are not positive. Disruptive scores are not negative.
 */
export function effectSemanticsError(record: EffectRecord): string | null {
  const score = record.effectScore;
  if (score !== null && (!Number.isInteger(score) || score < -4 || score > 4)) {
    return "effectScore must be an integer from −4 to +4, or null";
  }
  if (record.effectDirection === "PHYSIOLOGICAL") {
    if (score !== null) return "physiological activity cannot carry an effect score";
    if (record.quantitativeScoreSupported) {
      return "physiological activity is not a quantitative disruption score";
    }
  }
  if (record.effectDirection === "PROTECTIVE" && score !== null && score > 0) {
    return "a protective score cannot be positive";
  }
  if (record.effectDirection === "DISRUPTIVE" && score !== null && score < 0) {
    return "a disruptive score cannot be negative";
  }
  return null;
}

export function assertEffectSemantics(record: EffectRecord, label: string): void {
  const problem = effectSemanticsError(record);
  if (problem) throw new Error(`${label}: ${problem}`);
}

const MIXED_SEX = new Set(["mixed", "both", "both sexes", "male and female", "males and females"]);
const FEMALE_SEX = new Set(["female", "females", "f"]);
const MALE_SEX = new Set(["male", "males", "m"]);
const NOT_APPLICABLE_SEX = new Set(["not applicable", "n/a", "na", "none"]);

/** Conservative map from a free-text sex field. Unmapped wording stays in sexDetail. */
export function migrateReportedSex(
  raw: string | null | undefined,
  species?: string | null,
): { sex: ReportedSex; sexDetail: string | null } {
  const trimmed = raw?.trim() ?? "";
  const speciesKey = species?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    if (speciesKey === "not applicable" || speciesKey === "n/a" || speciesKey === "na") {
      return { sex: "NOT_APPLICABLE", sexDetail: null };
    }
    return { sex: "UNSPECIFIED", sexDetail: null };
  }
  const key = trimmed.toLowerCase();
  let sex: ReportedSex = "UNSPECIFIED";
  if (MIXED_SEX.has(key)) sex = "MIXED";
  else if (FEMALE_SEX.has(key)) sex = "FEMALE";
  else if (MALE_SEX.has(key)) sex = "MALE";
  else if (NOT_APPLICABLE_SEX.has(key)) sex = "NOT_APPLICABLE";
  return { sex, sexDetail: trimmed };
}
