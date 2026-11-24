import { env } from "~/env";

/**
 * Whether curator writes are allowed to run here.
 *
 * Every write from the web app changes a curator column -- curatorVerified,
 * curatorMappingState, a screening decision -- and those columns are the whole basis on which a
 * human judgment is told apart from a machine suggestion. The pipeline's guarantee is that a
 * machine stage never touches them, which is worth nothing if an anonymous request can.
 *
 * Until there is someone to authenticate, the answer is that the deployed site does not write at
 * all. `setCuratorDecision` already worked this way; the three mapping actions did not, and were
 * reachable on the live site. A server action is a public POST endpoint whose id sits in the
 * page's own JavaScript, so being unlinked and disallowed in robots.txt is not protection.
 *
 * NODE_ENV is "production" for both production and preview builds on Vercel and "development"
 * under `npm run dev`, which is exactly the line wanted: curation happens on a developer machine
 * against a database that machine chose.
 */
export function curatorWritesAllowed(): boolean {
  return env.NODE_ENV !== "production";
}
