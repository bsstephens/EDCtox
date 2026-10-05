export const CLAIM_DOMAIN = "reproductive";
export const CLAIM_PROVIDER = "deterministic";
export const CLAIM_MODEL = "bpa-claim-abstract-v1";
export const CLAIM_PROMPT_VERSION = "bpa-claim-abstract-v1";
export const CLAIM_TASK = "literature-claim-extraction";

/** Five BPA reproductive papers whose stored abstracts name a specific event. Not the machine-include queue. */
export const CLAIM_PILOT_PMIDS = ["40362320", "40753778", "26361328", "42023145", "27543890"] as const;

export const MITOCHONDRIAL_MECHANISM_CODES = [
  "ETC_COMPLEX_I",
  "ETC_COMPLEX_II",
  "ETC_COMPLEX_III",
  "ETC_COMPLEX_IV",
  "ATP_SYNTHASE",
  "ETC_FLUX",
  "ATP_PRODUCTION",
] as const;
