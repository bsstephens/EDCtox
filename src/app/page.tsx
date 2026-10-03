import Link from "next/link";
import type { ReactNode } from "react";

import { ScoreCell } from "~/components/ScoreCell";
import { DOMAIN_FULL_NAME, PROFILE_LABELS, prettyEnum } from "~/lib/labels";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const compoundTypes = [
  "PHARMACEUTICAL",
  "HORMONE",
  "PESTICIDE",
  "HERBICIDE",
  "FUNGICIDE",
  "INSECTICIDE",
  "PLASTICISER",
  "BISPHENOL",
  "PFAS",
  "FLAME_RETARDANT",
  "INDUSTRIAL_CHEMICAL",
  "METABOLITE",
  "POLLUTANT",
  "COSMETIC_INGREDIENT",
  "OTHER",
];

const lifeStages = [
  "PRECONCEPTION",
  "GAMETE",
  "EMBRYO",
  "FETUS",
  "NEONATAL",
  "INFANT",
  "EARLY_CHILDHOOD",
  "CHILDHOOD",
  "PUBERTY",
  "ADOLESCENCE",
  "ADULT",
  "PREGNANCY",
  "OLDER_ADULT",
];

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const minAbs = one(params.minAbsScore);
  const compounds = await api.atlas.list({
    q: one(params.q) || undefined,
    compoundType: one(params.compoundType) || undefined,
    domain: one(params.domain) || undefined,
    direction: one(params.direction) || undefined,
    confidence: one(params.confidence) || undefined,
    humanRelevance: one(params.humanRelevance) || undefined,
    lifeStage: one(params.lifeStage) || undefined,
    legacy: one(params.legacy) || undefined,
    exposureClass: one(params.exposureClass) || undefined,
    evidenceType: one(params.evidenceType) || undefined,
    recordKind: one(params.recordKind) || undefined,
    minAbsScore: minAbs ? Number(minAbs) : undefined,
    sort: one(params.sort) || undefined,
  });

  const sort = one(params.sort) || "name";

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compounds</h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            Each column is a domain headline: the strongest independent mechanistic cluster, not a sum. Empty cells are unscored, not evidence of safety. Seed numbers are hypotheses.
          </p>
        </div>
        <p className="text-sm text-stone-500">{compounds.length} shown</p>
      </div>

      <form className="mb-4 grid gap-3 rounded border border-stone-300 bg-white p-3 text-sm md:grid-cols-4" action="/">
        <label className="flex flex-col gap-1">
          Search
          <input name="q" defaultValue={one(params.q)} className="rounded border border-stone-300 px-2 py-1" />
        </label>
        <Select name="compoundType" label="Category" value={one(params.compoundType)} options={compoundTypes} />
        <Select name="domain" label="Domain" value={one(params.domain)} options={[...PROFILE_LABELS]} />
        <Select
          name="direction"
          label="Direction"
          value={one(params.direction)}
          options={["DISRUPTIVE", "PROTECTIVE", "PHYSIOLOGICAL", "CONTEXT_DEPENDENT", "MIXED"]}
        />
        <Select
          name="confidence"
          label="Confidence"
          value={one(params.confidence)}
          options={["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]}
        />
        <Select name="humanRelevance" label="Human relevance" value={one(params.humanRelevance)} options={["H0", "H1", "H2", "H3", "H4"]} />
        <Select name="lifeStage" label="Life stage" value={one(params.lifeStage)} options={lifeStages} />
        <Select name="legacy" label="Current or legacy" value={one(params.legacy)} options={["current", "legacy"]} />
        <Select name="exposureClass" label="Therapeutic or environmental" value={one(params.exposureClass)} options={["therapeutic", "environmental"]} />
        <Select
          name="evidenceType"
          label="Evidence class"
          value={one(params.evidenceType)}
          options={["IN_VITRO", "CELLULAR", "EX_VIVO", "ANIMAL", "HUMAN_OBSERVATIONAL", "HUMAN_PROSPECTIVE", "RANDOMIZED_TRIAL", "MECHANISTIC_REVIEW"]}
        />
        <Select name="recordKind" label="Record kind" value={one(params.recordKind)} options={["SPECIFIC_COMPOUND", "REPRESENTATIVE_STAND_IN", "CLASS_PLACEHOLDER", "FORMULATION"]} />
        <Select name="minAbsScore" label="Minimum |score|" value={minAbs} options={["1", "2", "3", "4"]} />
        <input type="hidden" name="sort" value={sort} />
        <div className="flex items-end gap-2">
          <button className="rounded bg-stone-900 px-3 py-1.5 text-white" type="submit">
            Filter
          </button>
          <Link href="/" className="rounded border border-stone-300 px-3 py-1.5">
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-stone-100 text-xs tracking-wide text-stone-600 uppercase">
            <tr>
              <th className="sticky left-0 bg-stone-100 px-3 py-2">
                <SortLink params={params} sortKey="name" current={sort}>
                  Compound
                </SortLink>
              </th>
              <th className="px-3 py-2">Category</th>
              {PROFILE_LABELS.map((label) => (
                <th key={label} className="px-2 py-2" title={DOMAIN_FULL_NAME[label]}>
                  <SortLink params={params} sortKey={label} current={sort}>
                    {label}
                  </SortLink>
                </th>
              ))}
              <th className="px-3 py-2">Human relevance</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Last reviewed</th>
            </tr>
          </thead>
          <tbody>
            {compounds.map((compound) => (
              <tr key={compound.slug} className="border-t border-stone-200 align-top">
                <td className="sticky left-0 bg-white px-3 py-2">
                  <Link href={`/compounds/${compound.slug}`} className="font-medium text-stone-950 underline-offset-2 hover:underline">
                    {compound.displayName}
                  </Link>
                  <div className="text-xs text-stone-500">{compound.recordKind === "SPECIFIC_COMPOUND" ? compound.canonicalName : prettyEnum(compound.recordKind)}</div>
                </td>
                <td className="px-3 py-2 text-stone-700">
                  <div>{prettyEnum(compound.compoundType)}</div>
                  <div className="text-xs text-stone-500">{compound.primaryCategory}</div>
                </td>
                {PROFILE_LABELS.map((label) => (
                  <td key={label} className="px-2 py-2">
                    <ScoreCell cell={compound.domains[label]} />
                  </td>
                ))}
                <td className="px-3 py-2 font-mono text-xs">{compound.humanRelevanceLabel}</td>
                <td className="px-3 py-2 text-xs">{prettyEnum(compound.confidenceLabel)}</td>
                <td className="px-3 py-2 text-xs text-stone-600">
                  {compound.lastReviewed ? compound.lastReviewed.slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <select name={name} defaultValue={value} className="rounded border border-stone-300 px-2 py-1">
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {prettyEnum(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortLink({
  params,
  sortKey,
  current,
  children,
}: {
  params: Search;
  sortKey: string;
  current: string;
  children: ReactNode;
}) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = one(value);
    if (text && key !== "sort") next.set(key, text);
  }
  next.set("sort", sortKey);
  return (
    <Link href={`/?${next.toString()}`} className={current === sortKey ? "text-stone-950" : "hover:text-stone-950"}>
      {children}
    </Link>
  );
}
