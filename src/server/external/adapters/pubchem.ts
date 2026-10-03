import { fetchJson } from "../http";
import type { PubChemCandidate, PubChemLookup } from "../identity";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PROPERTY_PATH = "Title,IUPACName,InChI,InChIKey,SMILES,CanonicalSMILES,MolecularFormula,MolecularWeight";

type FetchImpl = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseCidList(payload: unknown): number[] {
  const list = asRecord(asRecord(payload)?.IdentifierList);
  const cids = list?.CID;
  if (!Array.isArray(cids)) return [];
  return cids.filter((cid): cid is number => typeof cid === "number");
}

export function parseRegistryNumbers(payload: unknown): string[] {
  const information = asRecord(asRecord(payload)?.InformationList);
  const rows = information?.Information;
  if (!Array.isArray(rows)) return [];
  const numbers: string[] = [];
  for (const row of rows) {
    const rn = asRecord(row)?.RN;
    if (!Array.isArray(rn)) continue;
    for (const value of rn) {
      if (typeof value === "string") numbers.push(value);
    }
  }
  return numbers;
}

export function parsePubChemProperties(payload: unknown): PubChemCandidate | null {
  const table = asRecord(asRecord(payload)?.PropertyTable);
  const rows = table?.Properties;
  const row = Array.isArray(rows) ? asRecord(rows[0]) : null;
  if (!row || typeof row.CID !== "number") return null;
  return {
    cid: row.CID,
    title: text(row.Title),
    iupacName: text(row.IUPACName),
    inchi: text(row.InChI),
    inchiKey: text(row.InChIKey),
    smiles: text(row.CanonicalSMILES) ?? text(row.SMILES) ?? text(row.ConnectivitySMILES),
    molecularFormula: text(row.MolecularFormula),
    molecularWeight: text(row.MolecularWeight),
  };
}

async function getJson(url: string, fetchImpl: FetchImpl): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  try {
    const body = await fetchJson(url, { fetchImpl, timeoutMs: 20000 });
    return { ok: true, body };
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    if (status === 404 || status === 400) return { ok: false, status };
    throw error;
  }
}

export async function lookupPubChemByCas(cas: string, fetchImpl: FetchImpl = fetch): Promise<PubChemLookup> {
  const cidResponse = await getJson(`${PUG}/compound/xref/RN/${encodeURIComponent(cas)}/cids/JSON`, fetchImpl);
  const cids = cidResponse.ok ? parseCidList(cidResponse.body) : [];
  const limited = cids.slice(0, 6);
  const candidates: PubChemCandidate[] = [];

  for (const cid of limited) {
    const propertyResponse = await getJson(`${PUG}/compound/cid/${cid}/property/${PROPERTY_PATH}/JSON`, fetchImpl);
    if (!propertyResponse.ok) continue;
    const candidate = parsePubChemProperties(propertyResponse.body);
    if (candidate) candidates.push(candidate);
  }

  let registryNumbers: string[] = [];
  if (candidates.length === 1 && candidates[0]) {
    const registryResponse = await getJson(`${PUG}/compound/cid/${candidates[0].cid}/xrefs/RN/JSON`, fetchImpl);
    registryNumbers = registryResponse.ok ? parseRegistryNumbers(registryResponse.body) : [];
  }

  return { queryCas: cas, candidates, registryNumbers };
}
