import { externalDatasets } from "../../data/seeds/externalDatasets";

/** Registry of future adapters. Importing this module does not open a network connection. */
export const providerCodes = externalDatasets.map((dataset) => dataset.code);

export function importProvider(code: string): never {
  if (!providerCodes.includes(code)) {
    throw new Error(`${code} is not a registered external dataset.`);
  }
  throw new Error(
    `${code} import is not implemented. EDCtox does not call external networks in this phase, and an import must not change a curated mechanism score.`,
  );
}
