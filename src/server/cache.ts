import { unstable_cache } from "next/cache";

/**
 * Read cache for the public pages.
 *
 * The scientific data changes only on deploy (seed) or through a curator action in
 * /admin. Every public page used to run its queries on every request, which is what
 * exhausted the previous database's free tier (docs/ops/DATABASE_OPERATIONS_2026-10.md).
 *
 * Entries live in the Next data cache for a day, are tagged so a curator write can
 * drop them all with `revalidateTag(ATLAS_CACHE_TAG)`, and carry the deployment id in
 * their key so a new deploy never serves data cached by the previous one.
 *
 * Results are serialized as JSON, so loaders wrapped here must return plain data
 * (strings, numbers, booleans, arrays, objects), never Date or Decimal instances.
 */
export const ATLAS_CACHE_TAG = "atlas";
export const ATLAS_REVALIDATE_SECONDS = 60 * 60 * 24;

const deploymentKey = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local";

export function cachedQuery<Args extends unknown[], Result>(
  name: string,
  load: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return (...args: Args) =>
    unstable_cache(() => load(...args), [name, deploymentKey, JSON.stringify(args)], {
      revalidate: ATLAS_REVALIDATE_SECONDS,
      tags: [ATLAS_CACHE_TAG],
    })();
}
