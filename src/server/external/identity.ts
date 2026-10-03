export type ResolutionStatus =
  | "VERIFIED"
  | "PROBABLE"
  | "AMBIGUOUS"
  | "CONFLICT"
  | "NOT_FOUND"
  | "MANUAL_REVIEW_REQUIRED";

export type LocalCompoundIdentity = {
  slug: string;
  canonicalName: string;
  casNumber: string | null;
  molecularFormula: string | null;
  inchi: string | null;
  inchiKey: string | null;
  canonicalSmiles: string | null;
  pubChemCid: number | null;
  molarMass: string | null;
};

export type StructureField =
  | "pubChemCid"
  | "inchi"
  | "inchiKey"
  | "canonicalSmiles"
  | "molecularFormula"
  | "molarMass";

export type FieldDecision = {
  field: StructureField;
  action: "fill" | "keep" | "conflict";
  localValue: string | null;
  incomingValue: string | null;
};

export type IdentifierProposal = {
  namespace: "PUBCHEM_CID" | "INCHIKEY" | "CAS_RN" | "DTXSID";
  value: string;
  sourceUrl: string;
};

export type ProviderPlan = {
  providerCode: "PUBCHEM" | "EPA_COMPTOX";
  queryType: string;
  queryValue: string;
  status: ResolutionStatus;
  reason: string;
  candidateIds: string[];
  selectedExternalId: string | null;
  canonicalUrl: string | null;
  identifiers: IdentifierProposal[];
  fieldDecisions: FieldDecision[];
  cache: {
    recordType: string;
    externalId: string;
    payload: unknown;
  } | null;
  skipped: boolean;
};

export type PubChemCandidate = {
  cid: number;
  title: string | null;
  iupacName: string | null;
  inchi: string | null;
  inchiKey: string | null;
  smiles: string | null;
  molecularFormula: string | null;
  molecularWeight: string | null;
};

export type PubChemLookup = {
  queryCas: string;
  candidates: PubChemCandidate[];
  registryNumbers: string[];
};

export type CompToxCandidate = {
  dtxsid: string;
  casrn: string | null;
  preferredName: string | null;
};

const SALT_OR_ISOMER = /\b(potassium|sodium|ammonium|lithium|salt|branched|isomer)\b/i;

export function normalizeFormula(value: string | null | undefined): string | null {
  const compact = value?.replace(/\s+/g, "").toUpperCase() ?? "";
  return compact || null;
}

export function pubChemCompoundUrl(cid: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

export function comptoxDashboardUrl(dtxsid: string): string | null {
  if (!/^DTXSID\d+$/.test(dtxsid)) return null;
  return `https://comptox.epa.gov/dashboard/chemical/details/${dtxsid}`;
}

function looksLikeDifferentSubstance(localName: string, remoteTitle: string | null): boolean {
  if (!remoteTitle) return false;
  if (!SALT_OR_ISOMER.test(remoteTitle)) return false;
  return !SALT_OR_ISOMER.test(localName);
}

function decideField(field: StructureField, localValue: string | null, incomingValue: string | null): FieldDecision {
  if (!incomingValue) return { field, action: "keep", localValue, incomingValue };
  if (!localValue) return { field, action: "fill", localValue, incomingValue };
  if (localValue === incomingValue) return { field, action: "keep", localValue, incomingValue };
  return { field, action: "conflict", localValue, incomingValue };
}

export function judgePubChem(local: LocalCompoundIdentity, lookup: PubChemLookup): ProviderPlan {
  const base = {
    providerCode: "PUBCHEM" as const,
    queryType: "CAS_RN",
    queryValue: lookup.queryCas,
    identifiers: [] as IdentifierProposal[],
    fieldDecisions: [] as FieldDecision[],
    cache: null,
    skipped: false,
  };

  if (!local.casNumber) {
    return {
      ...base,
      status: "MANUAL_REVIEW_REQUIRED",
      reason: "This compound has no CAS number to query. Name-only matching is not used.",
      candidateIds: [],
      selectedExternalId: null,
      canonicalUrl: null,
    };
  }

  if (lookup.candidates.length === 0) {
    return {
      ...base,
      status: "NOT_FOUND",
      reason: `PubChem returned no CID for CAS ${lookup.queryCas}.`,
      candidateIds: [],
      selectedExternalId: null,
      canonicalUrl: null,
    };
  }

  if (lookup.candidates.length > 1) {
    const described = lookup.candidates
      .map((candidate) => `${candidate.cid}${candidate.title ? ` (${candidate.title}${candidate.molecularFormula ? `, ${candidate.molecularFormula}` : ""})` : ""}`)
      .join("; ");
    return {
      ...base,
      status: "AMBIGUOUS",
      reason: `PubChem returned ${lookup.candidates.length} CIDs for CAS ${lookup.queryCas}: ${described}. No identifier was selected.`,
      candidateIds: lookup.candidates.map((candidate) => String(candidate.cid)),
      selectedExternalId: null,
      canonicalUrl: null,
    };
  }

  const candidate = lookup.candidates[0];
  if (!candidate) {
    return {
      ...base,
      status: "NOT_FOUND",
      reason: `PubChem returned no CID for CAS ${lookup.queryCas}.`,
      candidateIds: [],
      selectedExternalId: null,
      canonicalUrl: null,
    };
  }

  const url = pubChemCompoundUrl(candidate.cid);
  const registryMatches = lookup.registryNumbers.includes(lookup.queryCas);
  const formula = normalizeFormula(candidate.molecularFormula);
  const localFormula = normalizeFormula(local.molecularFormula);
  const decisions = [
    decideField("pubChemCid", local.pubChemCid === null ? null : String(local.pubChemCid), String(candidate.cid)),
    decideField("inchi", local.inchi, candidate.inchi),
    decideField("inchiKey", local.inchiKey, candidate.inchiKey),
    decideField("canonicalSmiles", local.canonicalSmiles, candidate.smiles),
    decideField("molecularFormula", localFormula, formula),
    decideField("molarMass", local.molarMass, candidate.molecularWeight),
  ];

  if (!registryMatches) {
    return {
      ...base,
      status: "CONFLICT",
      reason: `CID ${candidate.cid} did not list CAS ${lookup.queryCas} among its registry numbers.`,
      candidateIds: [String(candidate.cid)],
      selectedExternalId: null,
      canonicalUrl: url,
      fieldDecisions: decisions,
    };
  }

  if (looksLikeDifferentSubstance(local.canonicalName, candidate.title)) {
    return {
      ...base,
      status: "MANUAL_REVIEW_REQUIRED",
      reason: `CID ${candidate.cid} is titled “${candidate.title}”, which does not match ${local.canonicalName}.`,
      candidateIds: [String(candidate.cid)],
      selectedExternalId: null,
      canonicalUrl: url,
      fieldDecisions: decisions,
    };
  }

  const conflict = decisions.find((decision) => decision.action === "conflict");
  if (conflict) {
    return {
      ...base,
      status: "CONFLICT",
      reason: `CID ${candidate.cid} disagrees with the stored ${conflict.field}. The stored value was left unchanged.`,
      candidateIds: [String(candidate.cid)],
      selectedExternalId: null,
      canonicalUrl: url,
      fieldDecisions: decisions,
    };
  }

  const identifiers: IdentifierProposal[] = [
    { namespace: "PUBCHEM_CID", value: String(candidate.cid), sourceUrl: url },
    ...(candidate.inchiKey ? [{ namespace: "INCHIKEY" as const, value: candidate.inchiKey, sourceUrl: url }] : []),
    { namespace: "CAS_RN", value: lookup.queryCas, sourceUrl: url },
  ];

  return {
    ...base,
    status: "VERIFIED",
    reason: `PubChem CID ${candidate.cid} matched CAS ${lookup.queryCas}${formula ? ` and formula ${formula}` : ""}.`,
    candidateIds: [String(candidate.cid)],
    selectedExternalId: String(candidate.cid),
    canonicalUrl: url,
    identifiers,
    fieldDecisions: decisions,
    cache: {
      recordType: "PUBCHEM_IDENTITY",
      externalId: String(candidate.cid),
      payload: candidate,
    },
  };
}

export function skippedCompToxPlan(cas: string): ProviderPlan {
  return {
    providerCode: "EPA_COMPTOX",
    queryType: "CAS_RN",
    queryValue: cas,
    status: "MANUAL_REVIEW_REQUIRED",
    reason: "CompTox was not queried. Set the server-only EPA_CTX_API_KEY environment variable and run the resolve command again. No DTXSID was invented.",
    candidateIds: [],
    selectedExternalId: null,
    canonicalUrl: null,
    identifiers: [],
    fieldDecisions: [],
    cache: null,
    skipped: true,
  };
}

export function judgeCompTox(local: LocalCompoundIdentity, cas: string, candidates: CompToxCandidate[]): ProviderPlan {
  const base = {
    providerCode: "EPA_COMPTOX" as const,
    queryType: "CAS_RN",
    queryValue: cas,
    fieldDecisions: [] as FieldDecision[],
    cache: null,
    skipped: false,
  };

  if (candidates.length === 0) {
    return {
      ...base,
      status: "NOT_FOUND",
      reason: `CompTox returned no chemical for CAS ${cas}.`,
      candidateIds: [],
      selectedExternalId: null,
      canonicalUrl: null,
      identifiers: [],
    };
  }

  if (candidates.length > 1) {
    return {
      ...base,
      status: "AMBIGUOUS",
      reason: `CompTox returned ${candidates.length} chemicals for CAS ${cas}. No DTXSID was selected.`,
      candidateIds: candidates.map((candidate) => candidate.dtxsid),
      selectedExternalId: null,
      canonicalUrl: null,
      identifiers: [],
    };
  }

  const candidate = candidates[0];
  if (!candidate) {
    return {
      ...base,
      status: "NOT_FOUND",
      reason: `CompTox returned no chemical for CAS ${cas}.`,
      candidateIds: [],
      selectedExternalId: null,
      canonicalUrl: null,
      identifiers: [],
    };
  }

  const url = comptoxDashboardUrl(candidate.dtxsid);
  if (candidate.casrn && candidate.casrn !== cas) {
    return {
      ...base,
      status: "CONFLICT",
      reason: `CompTox ${candidate.dtxsid} returned CAS ${candidate.casrn} for a query of ${cas}.`,
      candidateIds: [candidate.dtxsid],
      selectedExternalId: null,
      canonicalUrl: url,
      identifiers: [],
    };
  }

  if (looksLikeDifferentSubstance(local.canonicalName, candidate.preferredName)) {
    return {
      ...base,
      status: "MANUAL_REVIEW_REQUIRED",
      reason: `CompTox ${candidate.dtxsid} is named “${candidate.preferredName}”, which does not match ${local.canonicalName}.`,
      candidateIds: [candidate.dtxsid],
      selectedExternalId: null,
      canonicalUrl: url,
      identifiers: [],
    };
  }

  if (!url) {
    return {
      ...base,
      status: "MANUAL_REVIEW_REQUIRED",
      reason: "CompTox returned an identifier that is not a DTXSID.",
      candidateIds: [candidate.dtxsid],
      selectedExternalId: null,
      canonicalUrl: null,
      identifiers: [],
    };
  }

  return {
    ...base,
    status: "VERIFIED",
    reason: `CompTox ${candidate.dtxsid} matched CAS ${cas}.`,
    candidateIds: [candidate.dtxsid],
    selectedExternalId: candidate.dtxsid,
    canonicalUrl: url,
    identifiers: [{ namespace: "DTXSID", value: candidate.dtxsid, sourceUrl: url }],
    cache: {
      recordType: "COMPTOX_IDENTITY",
      externalId: candidate.dtxsid,
      payload: candidate,
    },
  };
}

export function unavailablePlan(providerCode: ProviderPlan["providerCode"], cas: string): ProviderPlan {
  return {
    providerCode,
    queryType: "CAS_RN",
    queryValue: cas,
    status: "MANUAL_REVIEW_REQUIRED",
    reason: "Live source unavailable. No identifier was written.",
    candidateIds: [],
    selectedExternalId: null,
    canonicalUrl: null,
    identifiers: [],
    fieldDecisions: [],
    cache: null,
    skipped: false,
  };
}

export function isCacheStale(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() < now.getTime();
}
