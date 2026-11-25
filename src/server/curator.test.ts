import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { curatorEmails, curatorWritesConfigured } from "./curator";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("every curator write action asks permission first", () => {
  // Three mapping actions wrote curator state on the live site with nothing stopping them. Those
  // columns are the whole basis on which a human judgment is told apart from a machine
  // suggestion, so the guarantee that no machine stage touches them is worth nothing if an
  // anonymous request can.
  const screening = read("src/app/admin/literature/actions.ts");
  const mapping = read("src/server/mapping/actions.ts");

  for (const [name, source] of [
    ["the screening action", screening],
    ["the mapping actions", mapping],
  ] as const) {
    assert.match(source, /await requireCurator\(\);/, `${name} must ask permission`);
    assert.match(source, /NotCuratorError/, `${name} must refuse, not warn`);
  }

  // The check lives in the mapping actions' shared runner, so a fourth action cannot be added
  // without it.
  const exported = [...mapping.matchAll(/export async function (\w+)/g)].map((match) => match[1]);
  assert.deepEqual(exported, ["verifyMapping", "remapMapping", "unmapMapping"]);
  assert.equal(mapping.match(/await requireCurator\(\)/g)?.length, 1);
});

test("the route guard is a layer, not the lock", () => {
  // A server action is its own POST endpoint whose id sits in the page's public JavaScript, and
  // the matcher stops covering an action the moment it is used from a page outside /admin.
  // In a project with a src directory Next only loads src/middleware.ts. A root-level
  // middleware.ts is silently ignored, which is how this one came to be dead code: /admin
  // appeared to 404 under a production build, but that was the page's own guard.
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /createRouteMatcher\(\["\/admin\(\.\*\)"\]\)/);
  assert.match(middleware, /auth\.protect\(\)/);
  // Public pages are not matched: they are read-only and the point of the site.
  assert.equal(middleware.includes('"/(.*)"'), false);
  // A production key cannot sign anyone in on localhost, so asking for a sign-in there would
  // lock the developer out of the queue they curate from.
  assert.match(middleware, /if \(deployed && isAdminRoute\(request\)\) await auth\.protect\(\);/);
});

test("the allowlist guards reading an admin page, not only writing from one", () => {
  // The middleware asks whether anyone is signed in. Until sign-up is restricted anyone can
  // create an account, and such an account could otherwise read every machine suggestion and
  // every curator decision while being refused only at the point of writing.
  const layout = read("src/app/admin/layout.tsx");
  assert.match(layout, /if \(!\(await isCurator\(\)\)\) notFound\(\);/);
});

test("the allowlist is parsed forgivingly and compared strictly", () => {
  const parsed = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  // Spacing and casing in configuration should not decide who may curate.
  assert.deepEqual(parsed(" Scott@Example.com , other@example.com ,"), ["scott@example.com", "other@example.com"]);
  // The real parser agrees with that, whatever the environment happens to hold.
  assert.deepEqual(curatorEmails(), parsed(process.env.CURATOR_EMAILS ?? ""));
});

test("a deployment with no allowlist writes nothing", () => {
  // Failing closed matters more than failing loudly here: forgetting the variable in production
  // must not mean anyone who signs up may curate. Clerk lets anyone create an account unless
  // sign-up is restricted, so authentication alone is not authorisation.
  const source = read("src/server/curator.ts");
  assert.match(source, /if \(allowed\.length === 0\) return false;/);
  // Only a verified address counts: anyone can type someone else's.
  assert.match(source, /verification\?\.status === "verified"/);
  // Locally there is nobody to authenticate, and curation has always run from a developer
  // machine against a database that machine chose.
  assert.equal(curatorWritesConfigured(), true);
});
