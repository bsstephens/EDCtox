import { lookupCompToxByCas } from "./adapters/comptox";
import { lookupPubChemByCas } from "./adapters/pubchem";
import {
  judgeCompTox,
  judgePubChem,
  skippedCompToxPlan,
  unavailablePlan,
  type LocalCompoundIdentity,
  type ProviderPlan,
} from "./identity";

export async function resolveCompoundIdentity(
  local: LocalCompoundIdentity,
  options: {
    epaApiKey?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ProviderPlan[]> {
  const cas = local.casNumber;
  if (!cas) {
    return [judgePubChem(local, { queryCas: "", candidates: [], registryNumbers: [] }), skippedCompToxPlan("")];
  }

  let pubchem: ProviderPlan;
  try {
    const lookup = await lookupPubChemByCas(cas, options.fetchImpl);
    pubchem = judgePubChem(local, lookup);
  } catch {
    pubchem = unavailablePlan("PUBCHEM", cas);
  }

  let comptox: ProviderPlan;
  if (!options.epaApiKey) {
    comptox = skippedCompToxPlan(cas);
  } else {
    try {
      const candidates = await lookupCompToxByCas(cas, options.epaApiKey, options.fetchImpl);
      comptox = judgeCompTox(local, cas, candidates);
    } catch {
      comptox = unavailablePlan("EPA_COMPTOX", cas);
    }
  }

  return [pubchem, comptox];
}
