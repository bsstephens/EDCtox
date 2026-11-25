import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { isCurator } from "~/server/curator";

/**
 * The allowlist, applied to reading an admin page and not only to writing from one.
 *
 * The middleware answers a different question: it asks whether anyone is signed in, and sends a
 * signed-out visitor to the sign-in page. Being signed in is not being allowed in. Until sign-up
 * is restricted, anyone can create an account, and without this check such an account could read
 * the claims list and the mapping queue -- every machine suggestion, and every curator decision
 * already recorded -- while being refused only at the point of writing.
 *
 * It sits in the layout rather than in each page because a layout cannot be bypassed by a route
 * the next page adds, and because Clerk now deprecates path matching for exactly this reason: a
 * matcher can diverge from how Next routes a request, and leave a protected page reachable. A
 * check on the resource cannot diverge from the resource.
 *
 * notFound(), not a redirect: a stranger learns nothing about what is here.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isCurator())) notFound();
  return <>{children}</>;
}
