import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Every write the web app makes changes a curator column, and those columns are the whole basis
 * on which a human judgment is told apart from a machine suggestion. The three mapping actions
 * were reachable and unguarded on the live site; only the screening action checked.
 */
test("every curator write action refuses when writes are not allowed", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  const screening = read("src/app/admin/literature/actions.ts");
  const mapping = read("src/server/mapping/actions.ts");

  for (const [name, source] of [
    ["the screening action", screening],
    ["the mapping actions", mapping],
  ] as const) {
    assert.match(source, /curatorWritesAllowed\(\)/, `${name} must consult the guard`);
    assert.match(source, /if \(!curatorWritesAllowed\(\)\) notFound\(\);/, `${name} must refuse, not warn`);
  }

  // The mapping file holds three exported actions and one guard, on purpose: the check lives in
  // the shared runner so a fourth action cannot be added without it.
  const exported = [...mapping.matchAll(/export async function (\w+)/g)].map((match) => match[1]);
  assert.deepEqual(exported, ["verifyMapping", "remapMapping", "unmapMapping"]);
  assert.equal(mapping.match(/curatorWritesAllowed\(\)/g)?.length, 1);

  // Guarded inside the action, not only in a route matcher. A server action is its own POST
  // endpoint whose id is in the page's public JavaScript, so being unlinked and disallowed in
  // robots.txt is not protection, and a matcher stops covering an action used from elsewhere.
  assert.equal(screening.includes("middleware"), false);
});
