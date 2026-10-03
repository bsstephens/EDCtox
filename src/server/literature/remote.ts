import { fetchJson, ProviderRequestError, redactSecrets } from "../external/http";
import { type IncomingPaper } from "./dedup";
import { parseEuropePmcSearch } from "./parseEuropePmc";
import { parseEsearch, parsePubmedArticles } from "./parsePubmed";
import { type LiteratureProviderName } from "./queries";

const NCBI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

async function fetchText(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    secrets?: Array<string | undefined>;
  },
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const secrets = options.secrets ?? [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
    try {
      const response = await fetchImpl(url, { headers: options.headers, signal: controller.signal });
      const body = await response.text();
      if (response.ok) return body;
      const message = redactSecrets(`Provider request failed with status ${response.status}.`, secrets.concat(body));
      lastError = new ProviderRequestError(message, response.status);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw lastError;
    } catch (error) {
      if (error instanceof ProviderRequestError && ![429, 500, 502, 503, 504].includes(error.status)) throw error;
      const message = redactSecrets(error instanceof Error ? error.message : "Provider request failed.", secrets);
      lastError = error instanceof ProviderRequestError ? error : new ProviderRequestError(message, 0);
      if (attempt === 2) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    await sleep(200 * 2 ** attempt);
  }

  throw lastError ?? new ProviderRequestError("Provider request failed.", 0);
}

export type LiteraturePage = {
  providerReportedCount: number;
  papers: IncomingPaper[];
};

export async function fetchLiteraturePage(options: {
  provider: LiteratureProviderName;
  query: string;
  sort: string | null;
  resultCap: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  ncbiApiKey?: string;
  ncbiEmail?: string;
}): Promise<LiteraturePage> {
  const cap = options.resultCap;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const headers = {
    "User-Agent": options.ncbiEmail ? `EDCtox (${options.ncbiEmail})` : "EDCtox",
  };

  if (options.provider === "EUROPE_PMC") {
    const params = new URLSearchParams({
      query: options.query,
      format: "json",
      pageSize: String(cap),
      resultType: "core",
    });
    if (options.sort) params.set("sort", options.sort);
    const payload = await fetchJson(`${EUROPE_PMC}?${params}`, {
      headers,
      fetchImpl: options.fetchImpl,
      sleep,
      timeoutMs: 30000,
    });
    await sleep(250);
    const parsed = parseEuropePmcSearch(payload);
    return { providerReportedCount: parsed.count, papers: parsed.papers.slice(0, cap) };
  }

  const searchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(cap),
    sort: options.sort ?? "relevance",
    term: options.query,
    tool: "edctox",
  });
  if (options.ncbiEmail) searchParams.set("email", options.ncbiEmail);
  if (options.ncbiApiKey) searchParams.set("api_key", options.ncbiApiKey);
  const secrets = [options.ncbiApiKey];
  const esearch = await fetchJson(`${NCBI}/esearch.fcgi?${searchParams}`, {
    headers,
    fetchImpl: options.fetchImpl,
    sleep,
    timeoutMs: 30000,
    secrets,
  });
  await sleep(options.ncbiApiKey ? 120 : 400);
  const found = parseEsearch(esearch);
  if (found.ids.length === 0) return { providerReportedCount: found.count, papers: [] };

  const fetchParams = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    id: found.ids.join(","),
    tool: "edctox",
  });
  if (options.ncbiEmail) fetchParams.set("email", options.ncbiEmail);
  if (options.ncbiApiKey) fetchParams.set("api_key", options.ncbiApiKey);
  const xml = await fetchText(`${NCBI}/efetch.fcgi?${fetchParams}`, {
    headers,
    fetchImpl: options.fetchImpl,
    sleep,
    secrets,
  });
  await sleep(options.ncbiApiKey ? 120 : 400);
  const papers = parsePubmedArticles(xml);
  if (papers.length === 0) throw new Error("PubMed returned identifiers but no articles.");
  return { providerReportedCount: found.count, papers };
}
