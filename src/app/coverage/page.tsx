import Link from "next/link";

import { CoverageGrid, CoverageLegend } from "~/components/CoverageGrid";
import { ViewSwitch } from "~/components/ViewSwitch";
import { loadCoverageMapCached } from "~/server/atlas/cached";
import {
  ARRANGEMENTS,
  arrangeRows,
  COLOURINGS,
  parseArrangement,
  parseColouring,
} from "~/server/atlas/coverageMap";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export const metadata = {
  title: "Coverage map",
  description:
    "Which compounds have been assessed in which biological domains, and how much of the matrix is still empty.",
};

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const arrangement = parseArrangement(one(params.arrange) || undefined);
  const colouring = parseColouring(one(params.colour) || undefined);

  const { columns, rows, totals } = await loadCoverageMapCached();
  const profileColumns = columns.filter(
    (column) => column.contributesToProfile,
  );
  const contextualColumns = columns.filter(
    (column) => !column.contributesToProfile,
  );
  const ordered = arrangeRows(rows, arrangement);
  const filledPercent = (
    (totals.assessedCells / totals.profileCells) *
    100
  ).toFixed(1);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Coverage map
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            One cell per compound and domain. It shows what has been assessed,
            not what is harmful. {totals.assessedCells} of {totals.profileCells}{" "}
            profile cells hold an assessment, which is {filledPercent}% of them,
            across {totals.compoundsWithAnyAssessment} of {totals.compounds}{" "}
            compounds.
          </p>
        </div>
        <ViewSwitch current="/coverage" />
      </div>

      <form
        className="mb-3 flex flex-wrap items-end gap-3 rounded border border-stone-300 bg-white p-3 text-sm"
        action="/coverage"
      >
        <label className="flex flex-col gap-1">
          Arrange by
          <select
            name="arrange"
            defaultValue={arrangement}
            className="rounded border border-stone-300 px-2 py-1"
          >
            {ARRANGEMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Colour by
          <select
            name="colour"
            defaultValue={colouring}
            className="rounded border border-stone-300 px-2 py-1"
          >
            {COLOURINGS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded bg-stone-900 px-3 py-1.5 text-white"
          type="submit"
        >
          Apply
        </button>
        <Link
          href="/coverage"
          className="rounded border border-stone-300 px-3 py-1.5"
        >
          Reset
        </Link>
      </form>

      <p className="mb-3 max-w-3xl text-sm leading-6 text-stone-700">
        Each column is a domain and each row a compound. A cell&rsquo;s position
        says which compound and which domain, and nothing else. An empty cell
        means nobody has assessed it. It is not evidence of safety, and a fuller
        row is not a more dangerous compound.
      </p>

      <div className="mb-3">
        <CoverageLegend colouring={colouring} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="overflow-x-auto rounded border border-stone-300 bg-white p-3 lg:shrink-0">
          <CoverageGrid
            columns={columns}
            rows={ordered}
            colouring={colouring}
          />
        </div>

        <section className="max-w-xl flex-1 space-y-2 text-sm leading-6 text-stone-700 lg:sticky lg:top-4">
          <h2 className="font-medium text-stone-900">What this picture is</h2>
          <p>
            The first {profileColumns.length} columns are the profile domains.
            The last {contextualColumns.length} (
            {contextualColumns.map((column) => column.shortLabel).join(" and ")}
            ) are stored and never enter a headline; they are shown because
            hiding them would imply they do not exist. The two track labels
            above the columns say which domains are endocrine disruption in the
            WHO/UNEP sense and which are EDCtox&rsquo;s own mechanistic layers.
            They are not added together, here or anywhere.
          </p>
          <p>
            {totals.assessments} mechanism assessments are stored, of which{" "}
            {totals.curatedAssessments} have left seed-hypothesis status.{" "}
            {totals.unmappedClaims} extracted claims are not yet mapped to a
            mechanism, so they have no cell on this map at all; they are what
            the mapping queue is for.
          </p>
          <p>
            Emptiness here is the state of the work, not a finding about the
            chemicals. It is the argument for the literature pipeline rather
            than a verdict delivered by it. Read{" "}
            <Link href="/methodology" className="underline underline-offset-2">
              the methodology
            </Link>{" "}
            for how a headline is computed, and the{" "}
            <Link href="/" className="underline underline-offset-2">
              table
            </Link>{" "}
            for the same information as text.
          </p>
          <p className="text-stone-600">
            Arranged by{" "}
            {ARRANGEMENTS.find(
              (item) => item.value === arrangement,
            )?.label.toLowerCase()}
            . Coloured by{" "}
            {COLOURINGS.find(
              (item) => item.value === colouring,
            )?.label.toLowerCase()}
            .
            {arrangement === "work"
              ? " Work done orders compounds by how much EDCtox has assessed them. It is not an ordering by harm."
              : ""}
            {arrangement === "score"
              ? " Magnitude is the strongest single cluster stored for a compound. It is not a total and not a rank of danger."
              : ""}
            {arrangement === "category" ? " Grouped by compound category." : ""}
          </p>
        </section>
      </div>
    </main>
  );
}
