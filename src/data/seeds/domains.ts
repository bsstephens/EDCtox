export const domains = [
  {
    code: "REPRODUCTIVE_ENDOCRINOLOGY",
    shortLabel: "REP",
    name: "Reproductive endocrinology",
    description:
      "Steroid receptors, steroidogenesis, the hypothalamic–pituitary–gonadal axis, and gonadal function.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 1,
  },
  {
    code: "DEVELOPMENTAL_ENDOCRINOLOGY",
    shortLabel: "DEV",
    name: "Developmental endocrinology",
    description:
      "Placental, fetal, pubertal, and programming mechanisms. Developmental toxicity that is not endocrine is still recorded here when that is the honest description, and the text says so.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 2,
  },
  {
    code: "NEUROENDOCRINE_HPA_CIRCADIAN",
    shortLabel: "NEUROENDO",
    name: "Neuroendocrine, HPA, and circadian",
    description:
      "Hypothalamic–pituitary–adrenal signalling, monoamines, melatonin receptors, circadian timing, appetite, and growth hormone. Thyroid signalling left this domain in November 2026 and is now its own column.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 3,
  },
  {
    code: "THYROID",
    shortLabel: "THY",
    name: "Thyroid",
    description:
      "Thyroid hormone synthesis, transport, metabolism, and receptor signalling, and the thyrotropin axis. Separated from the neuroendocrine domain in November 2026 because the WHO/UNEP 2026 assessment rates thyroid evidence as strong in both humans and animals and treats it as its own health domain. Thyroid-dependent brain development stays in the developmental domain: the outcome there is brain development, and moving it would hide a developmental signal.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 4,
  },
  {
    code: "IMMUNOLOGY_IMMUNOENDOCRINOLOGY",
    shortLabel: "IMM",
    name: "Immunology and immunoendocrinology",
    description:
      "Adaptive and innate immune function, cytokines, and immune effects that depend on endocrine context.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 5,
  },
  {
    code: "SYSTEMIC_METABOLISM",
    shortLabel: "MET",
    name: "Systemic metabolism",
    description:
      "Insulin secretion and signalling, hepatic glucose production, lipid handling, and adipokines.",
    contributesToProfile: true,
    track: "ENDOCRINE_DISRUPTION",
    sortOrder: 6,
  },
  {
    code: "MITOCHONDRIAL_BIOENERGETICS",
    shortLabel: "MITO",
    name: "Mitochondrial bioenergetics",
    description:
      "Electron transport, ATP synthesis, membrane energetics, and mitochondrial dynamics. Reorganization energy is a research field and is not scored from ATP or oxygen changes. This domain is bioenergetic harm, not endocrine disruption, and the WHO/UNEP assessment does not treat it as an endocrine domain.",
    contributesToProfile: true,
    track: "CELLULAR_BIOENERGETIC",
    sortOrder: 7,
  },
  {
    code: "REDOX_CELLULAR_STRESS",
    shortLabel: "REDOX",
    name: "Redox and cellular stress",
    description:
      "Reactive oxygen and nitrogen species, antioxidant systems, oxidative damage, cell fate, and stress-response pathways. Like the mitochondrial domain, this is cellular harm rather than endocrine disruption in the WHO/IPCS sense.",
    contributesToProfile: true,
    track: "CELLULAR_BIOENERGETIC",
    sortOrder: 8,
  },
  {
    code: "EXPOSURE_DEVELOPMENTAL_MODIFIERS",
    shortLabel: "EXPOSURE",
    name: "Exposure and developmental modifiers",
    description:
      "Contextual modifiers: co-formulants, mixtures, therapeutic versus environmental dose, and developmental window. This domain does not contribute a profile score and is never added to mechanistic domains.",
    contributesToProfile: false,
    track: "CONTEXTUAL",
    sortOrder: 9,
  },
  {
    code: "VASCULAR_ENDOTHELIAL",
    shortLabel: "VASCULAR",
    name: "Vascular and endothelial",
    description:
      "Nitric oxide and vascular tone, endothelial barrier, angiogenesis, haemostasis, and microvascular function. Stored so those mechanisms are not forced into an immune or redox headline. The WHO/UNEP 2026 assessment rates cardiovascular evidence as emerging in humans and animals, which is why this domain does not contribute a profile column.",
    contributesToProfile: false,
    track: "CONTEXTUAL",
    sortOrder: 10,
  },
] as const;

export type DomainCode = (typeof domains)[number]["code"];
export type DomainShortLabel = (typeof domains)[number]["shortLabel"];
export type DomainTrack = (typeof domains)[number]["track"];
