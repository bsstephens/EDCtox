import { fetchJson } from "../http";
import type { CompToxCandidate } from "../identity";

const SEARCH_URL = "https://api-ccte.epa.gov/chemical/search/equal/";

type FetchImpl = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseCompToxChemicals(payload: unknown): CompToxCandidate[] {
  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const candidates: CompToxCandidate[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const dtxsid = text(record?.dtxsid);
    if (!dtxsid) continue;
    candidates.push({
      dtxsid,
      casrn: text(record?.casrn),
      preferredName: text(record?.preferredName),
    });
  }
  return candidates;
}

export async function lookupCompToxByCas(cas: string, apiKey: string, fetchImpl: FetchImpl = fetch): Promise<CompToxCandidate[]> {
  try {
    const body = await fetchJson(`${SEARCH_URL}${encodeURIComponent(cas)}`, {
      fetchImpl,
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
      },
      secrets: [apiKey],
      timeoutMs: 20000,
    });
    return parseCompToxChemicals(body);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    if (status === 400 || status === 404) return [];
    throw error;
  }
}
