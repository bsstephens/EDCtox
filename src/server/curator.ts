import { currentUser } from "@clerk/nextjs/server";

import { env } from "~/env";

/**
 * Who is allowed to write a curator column.
 *
 * Every write from the web app changes curatorVerified, curatorMappingState or a screening
 * decision, and those columns are the whole basis on which a human judgment is told apart from a
 * machine suggestion. The pipeline's guarantee that no machine stage touches them is worth
 * nothing if an anonymous request can.
 *
 * Two separate questions are asked here, because Clerk answers only the first one. Signing in is
 * not the same as being allowed in: Clerk lets anyone create an account unless sign-up is
 * restricted, so a check for "is there a session" would hand the curator queue to any stranger
 * who signed up. The allowlist is the authorisation half, and it lives in configuration so that
 * changing who may curate is not a deploy.
 *
 * Both halves are enforced inside the action rather than only in middleware. A server action is
 * its own POST endpoint whose id sits in the page's public JavaScript, and a route matcher stops
 * covering an action the moment it is used from a page outside the matched path.
 */

export class NotCuratorError extends Error {}

/** Lowercased, so a configured address and a provider's casing cannot disagree. */
export function curatorEmails(): string[] {
  return (env.CURATOR_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether this deployment is configured to accept curator writes at all.
 *
 * Without an allowlist there is nobody to authorise, so the answer is nobody, and a deployment
 * that forgets the variable fails closed rather than open. Local development is exempt: curation
 * happens on a developer machine against a database that machine chose, which is how it worked
 * before any of this and how the pipeline scripts still work.
 */
export function curatorWritesConfigured(): boolean {
  return env.NODE_ENV !== "production" || curatorEmails().length > 0;
}

/** True when the signed-in user is on the allowlist, by any of their verified addresses. */
export async function isCurator(): Promise<boolean> {
  if (env.NODE_ENV !== "production") return true;
  const allowed = curatorEmails();
  if (allowed.length === 0) return false;

  const user = await currentUser();
  if (!user) return false;
  return user.emailAddresses.some(
    (address) =>
      // Verified only. An unverified address proves nothing: anyone can type someone else's.
      address.verification?.status === "verified" &&
      allowed.includes(address.emailAddress.trim().toLowerCase()),
  );
}

/** Throws unless the caller may write curator columns. Call it first, in the action itself. */
export async function requireCurator(): Promise<void> {
  if (!(await isCurator())) throw new NotCuratorError("Curator sign-in required.");
}
