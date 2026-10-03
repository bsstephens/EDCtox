const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let text = message;
  for (const secret of secrets) {
    if (!secret) continue;
    text = text.split(secret).join("[redacted]");
  }
  return text;
}

export async function fetchJson(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    secrets?: Array<string | undefined>;
  } = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const retries = options.retries ?? 2;
  const secrets = options.secrets ?? [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
    try {
      const response = await fetchImpl(url, { headers: options.headers, signal: controller.signal });
      const body = await response.text();
      if (response.ok) {
        try {
          return JSON.parse(body) as unknown;
        } catch {
          throw new ProviderRequestError(redactSecrets("Provider returned a response that was not JSON.", secrets), response.status);
        }
      }
      const message = redactSecrets(`Provider request failed with status ${response.status}.`, secrets.concat(body));
      lastError = new ProviderRequestError(message, response.status);
      if (!RETRY_STATUSES.has(response.status) || attempt === retries) throw lastError;
    } catch (error) {
      if (error instanceof ProviderRequestError && !RETRY_STATUSES.has(error.status)) throw error;
      const message = redactSecrets(error instanceof Error ? error.message : "Provider request failed.", secrets);
      lastError = error instanceof ProviderRequestError ? error : new ProviderRequestError(message, 0);
      if (attempt === retries) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    await sleep(200 * 2 ** attempt);
  }

  throw lastError ?? new ProviderRequestError("Provider request failed.", 0);
}
