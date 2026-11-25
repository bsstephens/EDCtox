import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the admin pages behind a sign-in.
 *
 * This is the outer door only. Every action that writes a curator column checks again for
 * itself, because a server action is its own POST endpoint whose id sits in the page's public
 * JavaScript, and this matcher stops covering an action the moment it is used from a page
 * outside /admin. Losing the route guard should cost a layer, not the lock.
 *
 * Public pages are deliberately not matched. They are server-rendered, read-only and the point
 * of the site.
 */
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/**
 * With no publishable key, Clerk's middleware waves every request through rather than failing,
 * which was verified by running the app with no keys set: /admin answered 200 and nothing was
 * logged. Writes would still have been refused, because the curator check fails closed, but the
 * pages would have been readable with no sign that protection was missing.
 *
 * A deployment that forgets the key is a mistake, and the safe reading of a missing lock is that
 * the door is shut. Locally it stays open: there is nobody to authenticate, and curation has
 * always run from a developer machine against a database that machine chose.
 */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const deployed = process.env.NODE_ENV === "production";

function adminUnavailable(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

export default function middleware(request: NextRequest, event: Parameters<typeof handler>[1]) {
  if (isAdminRoute(request) && deployed && !clerkConfigured) return adminUnavailable();
  if (!clerkConfigured) return NextResponse.next();
  return handler(request, event);
}

/**
 * Only a deployed build asks for a sign-in, which is the same line the curator check draws.
 *
 * A production instance's session cookie is bound to its own domain, so a production key cannot
 * sign anyone in on localhost: protecting the local pages with one would lock the developer out
 * of the queue they curate from, with no way in. Local admin stays open, as it has been
 * throughout, and the database a local run writes is the one that machine chose.
 */
const handler = clerkMiddleware(async (auth, request) => {
  if (deployed && isAdminRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    // Everything except Next internals and static files, so the matcher above decides.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
