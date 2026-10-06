import Link from "next/link";

import { prettyEnum } from "~/lib/labels";
import { loadFamilyAudit } from "~/server/mapping/families";
import { remapMapping, unmapMapping, verifyMapping } from "~/server/mapping/actions";
import { filterQueue, loadMappingQueue, loadMechanismChoices } from "~/server/mapping/queue";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function MappingQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = one(params.q);
  const error = one(params.error);
  const [queue, choices, audit] = await Promise.all([loadMappingQueue(db), loadMechanismChoices(db), loadFamilyAudit(db)]);
  const rows = filterQueue(queue, query);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm text-stone-600">
        Unlisted mapping queue. It is not in the public navigation. A mapping does not change a score and does not create a finding.{" "}
        <Link className="underline" href="/admin/literature/claims">
          Claim review list
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Claim mapping</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
        Verify the current mechanism, map the claim to a different existing mechanism, or leave it unmapped. The machine suggestion stays on the claim. Grouping-only parents are not claim targets. The supporting sentence stays on the claim review list.
      </p>
      {error ? <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
      <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" action="/admin/mechanisms/mapping">
        <label className="flex flex-col gap-1">
          Search
          <input name="q" defaultValue={query} className="rounded border border-stone-300 bg-white px-2 py-1" />
        </label>
        <button className="rounded bg-stone-900 px-3 py-1.5 text-white" type="submit">
          Filter
        </button>
        <Link href="/admin/mechanisms/mapping" className="rounded border border-stone-300 px-3 py-1.5">
          Reset
        </Link>
      </form>
      <p className="mt-3 text-sm text-stone-500">
        {rows.length} of {queue.length}
      </p>
      <datalist id="mechanism-codes">
        {choices.map((choice) => (
          <option key={choice.code} value={choice.code}>
            {choice.code} · {choice.name} · {choice.domainShortLabel} · Parent: {choice.parentName ?? "none"} · Family: {choice.familyName ?? "none"}
          </option>
        ))}
      </datalist>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <article key={row.id} className="rounded border border-stone-300 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">
                <Link className="underline" href={`/compounds/${row.compoundSlug}`}>
                  {row.compoundName}
                </Link>{" "}
                · {row.subjectText} {prettyEnum(row.relation)} {row.objectText}
              </h2>
              <p className="text-xs text-stone-500">{prettyEnum(row.state)} · {prettyEnum(row.directness)}{row.domainShortLabel ? ` · ${row.domainShortLabel}` : ""}</p>
            </div>
            <p className="mt-1 text-stone-700">
              {row.title} · {row.year}
              {row.pmid ? ` · PMID ${row.pmid}` : ""}
              {row.reviewDerived ? " · review-derived" : ""}
            </p>
            <p className="mt-1 text-stone-600">
              {[row.speciesText, row.tissueText, row.cellTypeText, row.doseText].filter(Boolean).join(" · ") || "No species, tissue, cell, or dose text"}
            </p>
            <p className="mt-1">
              Machine suggested: {row.machineMechanismCode ? `${row.machineMechanismCode} · ${row.machineMechanismName}` : "none"}
            </p>
            <p>
              Current mechanism: {row.mechanismCode ? `${row.mechanismCode} · ${row.mechanismName}` : "unmapped"} · {row.curatorVerified ? "Curator verified" : "Machine-extracted"}
            </p>
            {row.events.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-stone-600">Mapping history ({row.events.length})</summary>
                <ul className="mt-1 space-y-1 text-xs text-stone-600">
                  {row.events.map((event) => (
                    <li key={event.id}>
                      {event.createdAt.slice(0, 16).replace("T", " ")} · {event.action} · {event.fromState} → {event.toState}
                      {event.fromMechanismCode ? ` · from ${event.fromMechanismCode}` : ""}
                      {event.toMechanismCode ? ` · to ${event.toMechanismCode}` : ""} · {event.actor}
                      {event.note ? ` · ${event.note}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="mt-2 text-xs text-stone-500">No curator action yet.</p>
            )}
            <form className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="claimId" value={row.id} />
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-stone-600">
                Mechanism code
                <input name="mechanismCode" list="mechanism-codes" placeholder="Code" className="rounded border border-stone-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-stone-600">
                Note
                <input name="note" className="rounded border border-stone-300 px-2 py-1 text-sm" />
              </label>
              {row.mechanismCode ? (
                <button className="rounded bg-stone-900 px-3 py-1.5 text-white" formAction={verifyMapping} type="submit">
                  Verify mapping
                </button>
              ) : (
                <span className="px-1 text-xs text-stone-500">No current mechanism to verify.</span>
              )}
              <button className="rounded border border-stone-300 px-3 py-1.5" formAction={remapMapping} type="submit">
                Map to this mechanism
              </button>
              <button className="rounded border border-stone-300 px-3 py-1.5" formAction={unmapMapping} type="submit">
                Leave unmapped
              </button>
            </form>
          </article>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Family audit</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Total mechanisms: {audit.total}. Family assigned: {audit.assigned}. Family missing: {audit.missing}. Missing but assignable from a parent family: {audit.assignable}. Intentionally unassigned: {audit.intentional}. Stored families: {audit.familyCodes.join(", ") || "none"}. This report does not create families or assign them.
        </p>
        <div className="mt-3 space-y-2">
          {audit.domains.map((domain) => (
            <details key={domain.code} className="rounded border border-stone-300 bg-white p-3 text-sm">
              <summary className="cursor-pointer">
                {domain.shortLabel} · {domain.name}: {domain.missing.length} without a family
              </summary>
              <ul className="mt-2 space-y-1 text-stone-700">
                {domain.missing.map((item) => (
                  <li key={item.code}>
                    {item.code} · {item.name}
                    {item.parentFamilyName ? ` · parent family ${item.parentFamilyName}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
