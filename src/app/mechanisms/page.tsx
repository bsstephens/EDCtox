import Link from "next/link";

import { prettyEnum } from "~/lib/labels";
import { db } from "~/server/db";
import { filterMechanismRows, loadMechanismRows, mechanismOptions, mechanismStatus, parseMechanismFilters } from "~/server/mechanisms/query";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <select name={name} defaultValue={value} className="rounded border border-stone-300 bg-white px-2 py-1">
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function MechanismsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseMechanismFilters(params);
  const rows = await loadMechanismRows(db);
  const visible = filterMechanismRows(rows, filters);
  const options = mechanismOptions(rows);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mechanisms</h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            Every mechanism in the ontology, including those with no claims and no assessment. A claim count is not a score. Machine-extracted claims stay labeled, and a candidate mapping is not a curator-verified one.
          </p>
        </div>
        <p className="text-sm text-stone-500">
          {visible.length} of {rows.length}
        </p>
      </div>
      <form className="mb-4 grid gap-3 rounded border border-stone-300 bg-white p-3 text-sm md:grid-cols-4" action="/mechanisms">
        <label className="flex flex-col gap-1 md:col-span-2">
          Search
          <input name="q" defaultValue={one(params.q)} className="rounded border border-stone-300 bg-white px-2 py-1" />
        </label>
        <Select name="domain" label="Domain" value={filters.domain} options={options.domains} />
        <Select name="family" label="Family" value={filters.family} options={options.families} />
        <Select
          name="policy"
          label="Score policy"
          value={filters.policy}
          options={[
            { value: "SCORABLE", label: "Scorable" },
            { value: "RESEARCH_ONLY", label: "Research only" },
            { value: "GROUPING_ONLY", label: "Grouping only" },
          ]}
        />
        <Select name="parent" label="Parent" value={filters.parent} options={[{ value: "none", label: "No parent" }, ...options.parents]} />
        <Select name="group" label="Aggregation group" value={filters.group} options={options.groups} />
        <Select
          name="profile"
          label="Profile domain"
          value={filters.profile}
          options={[
            { value: "profile", label: "In the seven profile columns" },
            { value: "other", label: "Not in the profile score" },
          ]}
        />
        <Select
          name="assessments"
          label="Assessments"
          value={filters.assessments}
          options={[
            { value: "yes", label: "Has an assessment" },
            { value: "no", label: "No assessment" },
          ]}
        />
        <Select
          name="claims"
          label="Claims"
          value={filters.claims}
          options={[
            { value: "yes", label: "Has a claim" },
            { value: "no", label: "No claims" },
          ]}
        />
        <Select
          name="verified"
          label="Curator-verified claims"
          value={filters.verified}
          options={[
            { value: "yes", label: "Has a verified claim" },
            { value: "no", label: "No verified claim" },
          ]}
        />
        <Select
          name="directness"
          label="Claim directness"
          value={filters.directness}
          options={[
            { value: "DIRECTLY_DEMONSTRATED", label: "Directly demonstrated" },
            { value: "STRONGLY_SUPPORTED", label: "Strongly supported" },
            { value: "CONSISTENT_WITH", label: "Consistent with" },
            { value: "INFERRED", label: "Inferred" },
            { value: "HYPOTHESIZED", label: "Hypothesized" },
          ]}
        />
        <Select
          name="mapping"
          label="Mapping status"
          value={filters.mapping}
          options={[
            { value: "CANDIDATE", label: "Candidate mapping" },
            { value: "VERIFIED", label: "Curator-verified mapping" },
          ]}
        />
        <div className="flex items-end gap-2">
          <button className="rounded bg-stone-900 px-3 py-1.5 text-white" type="submit">
            Filter
          </button>
          <Link href="/mechanisms" className="rounded border border-stone-300 px-3 py-1.5">
            Reset
          </Link>
        </div>
      </form>
      <div className="overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="bg-stone-100 text-xs tracking-wide text-stone-600 uppercase">
            <tr>
              <th className="px-3 py-2">Mechanism</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Family</th>
              <th className="px-3 py-2">Parent</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Policy</th>
              <th className="px-3 py-2">Assessed</th>
              <th className="px-3 py-2">Claims</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Direct</th>
              <th className="px-3 py-2">Inferred</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.code} className="border-t border-stone-200 align-top">
                <td className="px-3 py-2">
                  <Link href={`/mechanisms/${row.code}`} className="font-medium underline-offset-4 hover:underline">
                    {row.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-stone-500">{row.code}</span>
                </td>
                <td className="px-3 py-2">
                  {row.domainShortLabel}
                  {row.profile ? "" : " · not in profile"}
                </td>
                <td className="px-3 py-2">{row.familyName ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.parentCode ? (
                    <Link href={`/mechanisms/${row.parentCode}`} className="underline-offset-4 hover:underline">
                      {row.parentName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{row.aggregationGroup}</td>
                <td className="px-3 py-2">{prettyEnum(row.scorePolicy)}</td>
                <td className="px-3 py-2">{row.assessmentCompounds}</td>
                <td className="px-3 py-2">
                  {row.claimCount}
                  {row.claimCompounds > 0 ? <span className="block text-xs text-stone-500">{row.claimCompounds} compounds</span> : null}
                </td>
                <td className="px-3 py-2">{row.verifiedClaims}</td>
                <td className="px-3 py-2">{row.directClaims}</td>
                <td className="px-3 py-2">{row.inferredClaims}</td>
                <td className="px-3 py-2 text-xs text-stone-600">{mechanismStatus(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
