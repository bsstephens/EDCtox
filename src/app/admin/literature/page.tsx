import Link from "next/link";
import { notFound } from "next/navigation";

import { ScreeningDesk } from "~/app/admin/literature/ScreeningDesk";
import { env } from "~/env";
import { prettyEnum } from "~/lib/labels";
import { db } from "~/server/db";
import { filterScreeningCards, loadBpaScreeningQueue, parseScreeningFilters } from "~/server/screening/queue";
import { SCREENING_DOMAIN, SCREENING_QUERY_VERSION } from "~/server/screening/reasons";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LiteratureScreeningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const filters = parseScreeningFilters(params);
  const queue = await loadBpaScreeningQueue(db);
  const visible = filterScreeningCards(queue.cards, filters);
  const curator = {
    included: queue.cards.filter((card) => card.curatorDecision === "INCLUDE").length,
    excluded: queue.cards.filter((card) => card.curatorDecision === "EXCLUDE").length,
    uncertain: queue.cards.filter((card) => card.curatorDecision === "UNCERTAIN").length,
  };
  const decided = queue.cards.filter((card) => card.curatorDecision && card.machineDecision);
  const agreed = decided.filter((card) => card.curatorDecision === card.machineDecision).length;
  const years = [...new Set(queue.cards.map((card) => card.year).filter((year): year is number => year !== null))].sort((a, b) => b - a);
  const signals = [...new Set(queue.cards.map((card) => card.studySignal).filter((signal): signal is string => Boolean(signal)))].sort();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm">
        <Link className="underline" href="/admin">
          Curation
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Literature screening</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
        Development-only queue for BPA and the reproductive domain, query {SCREENING_QUERY_VERSION}. A decision here is about this compound and domain. It does not change the publication record, create a finding, or change a score. Machine suggestions stay visible after a curator decision.{" "}
        <Link className="underline" href="/admin/literature/claims">
          Mechanistic claims
        </Link>{" "}
        from five stored abstracts are a separate local list.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Candidates", queue.cards.length],
          ["Unscreened", queue.cards.filter((card) => !card.curatorDecision).length],
          ["Included", curator.included],
          ["Excluded", curator.excluded],
          ["Uncertain", curator.uncertain],
          ["Machine suggestions", queue.cards.filter((card) => card.machineDecision).length],
          ["Duplicate hits", queue.duplicateHitCount],
          ["Retracted", queue.cards.filter((card) => card.retracted).length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded border border-stone-300 bg-white p-2">
            <dt className="text-stone-500">{label}</dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-stone-600">
        Compound BPA. Domain {SCREENING_DOMAIN}.{" "}
        {decided.length === 0
          ? "Agreement is not calculated until curator decisions exist."
          : `Machine and curator decisions match on ${agreed} of ${decided.length} cards with both. This is workflow agreement, not scientific accuracy.`}
      </p>
      <form className="mt-4 flex flex-wrap gap-2 text-sm" method="get">
        <select name="curator" defaultValue={one(params.curator)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Curator: any</option>
          <option value="pending">Unscreened</option>
          <option value="INCLUDE">Included</option>
          <option value="EXCLUDE">Excluded</option>
          <option value="UNCERTAIN">Uncertain</option>
        </select>
        <select name="machine" defaultValue={one(params.machine)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Machine: any</option>
          <option value="none">No suggestion</option>
          <option value="INCLUDE">Include</option>
          <option value="EXCLUDE">Exclude</option>
          <option value="UNCERTAIN">Uncertain</option>
        </select>
        <select name="purpose" defaultValue={one(params.purpose)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Purpose: any</option>
          <option value="SYSTEMATIC_REVIEWS">Systematic reviews</option>
          <option value="HUMAN_REPRODUCTIVE">Human reproductive</option>
          <option value="CONTRADICTORY_OR_NULL">Contradictory or null</option>
        </select>
        <select name="provider" defaultValue={one(params.provider)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Provider: any</option>
          <option value="PUBMED">PubMed</option>
          <option value="EUROPE_PMC">Europe PMC</option>
        </select>
        <select name="year" defaultValue={one(params.year)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Year: any</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select name="signal" defaultValue={one(params.signal)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Type: any</option>
          {signals.map((signal) => (
            <option key={signal} value={signal}>
              {signal}
            </option>
          ))}
        </select>
        <select name="abstract" defaultValue={one(params.abstract)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Abstract: any</option>
          <option value="yes">Abstract stored</option>
          <option value="no">No abstract</option>
        </select>
        <select name="oa" defaultValue={one(params.oa)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Access: any</option>
          <option value="yes">Open access</option>
          <option value="no">Not open access</option>
        </select>
        <select name="retracted" defaultValue={one(params.retracted)} className="border border-stone-300 bg-white px-2 py-1">
          <option value="">Retracted: show</option>
          <option value="hide">Hide retracted</option>
          <option value="only">Retracted only</option>
        </select>
        <button className="border border-stone-400 px-2 py-1" type="submit">
          Filter
        </button>
      </form>
      <ScreeningDesk cards={visible.map((card) => ({ ...card, purposes: [...card.purposes], windows: [...card.windows] }))} />
      <p className="mt-6 text-xs text-stone-500">
        Showing {visible.length} of {queue.cards.length}. {prettyEnum(SCREENING_DOMAIN)} screening does not mark the compound scientifically curated.
      </p>
    </main>
  );
}
