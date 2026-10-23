import { cachedQuery } from "~/server/cache";
import { loadCompoundCoverage } from "~/server/coverage/query";
import { db } from "~/server/db";
import { loadMechanismDetail, loadMechanismRows } from "~/server/mechanisms/query";

import { getCompound, listCompounds, listEvidence } from "./queries";

/**
 * Cached entry points for the public pages. Admin pages keep calling the loaders
 * directly so a curator always sees the current rows.
 */
export const listCompoundsCached = cachedQuery("listCompounds", listCompounds);
export const getCompoundCached = cachedQuery("getCompound", getCompound);
export const listEvidenceCached = cachedQuery("listEvidence", listEvidence);
export const loadMechanismRowsCached = cachedQuery("mechanismRows", () => loadMechanismRows(db));
export const loadMechanismDetailCached = cachedQuery("mechanismDetail", (code: string) => loadMechanismDetail(db, code));
export const loadCompoundCoverageCached = cachedQuery("compoundCoverage", (slug: string) => loadCompoundCoverage(db, slug));
