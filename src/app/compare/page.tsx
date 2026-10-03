import Link from "next/link";

import { ScoreCell } from "~/components/ScoreCell";
import { CONFIDENCE_LABEL, DOMAIN_FULL_NAME, HUMAN_LABEL, PROFILE_LABELS } from "~/lib/labels";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

const presets = [
  ["BPA, BPAF, BPS", "bpa,bpaf,bps"],
  ["DEHP, DINP, DINCH", "dehp,dinp,dinch"],
  ["Olanzapine, risperidone, aripiprazole", "olanzapine,risperidone,aripiprazole"],
  ["Fluoxetine, sertraline, methylphenidate", "fluoxetine,sertraline,methylphenidate"],
  ["PFOS, PFOA", "pfos,pfoa"],
  ["Paraquat, rotenone, boscalid", "paraquat,rotenone,boscalid"],
  ["Melatonin, paraquat, rotenone", "melatonin,paraquat,rotenone"],
];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ slugs?: string }>;
}) {
  const params = await searchParams;
  const slugs = (params.slugs ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 6);
  const compounds = slugs.length >= 2 ? await api.atlas.compare({ slugs }) : [];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">
        Two to six compounds, domain by domain. A higher number in one column is not added to another column. Unscored analogues are left blank rather than copied from a parent chemical.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {presets.map(([label, value]) => (
          <Link key={value} href={`/compare?slugs=${value}`} className="rounded border border-stone-300 bg-white px-2 py-1 hover:bg-stone-50">
            {label}
          </Link>
        ))}
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" action="/compare">
        <label className="flex flex-col gap-1">
          Slugs, comma-separated
          <input
            name="slugs"
            defaultValue={params.slugs ?? ""}
            placeholder="bpa, bpaf, bps"
            className="w-80 rounded border border-stone-300 px-2 py-1"
          />
        </label>
        <button className="rounded bg-stone-900 px-3 py-1.5 text-white" type="submit">
          Compare
        </button>
      </form>

      {compounds.length >= 2 ? (
        <div className="mt-6 overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="px-3 py-2">Domain</th>
                {compounds.map((compound) => (
                  <th key={compound.slug} className="px-3 py-2">
                    <Link href={`/compounds/${compound.slug}`} className="underline-offset-2 hover:underline">
                      {compound.displayName}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROFILE_LABELS.map((label) => (
                <tr key={label} className="border-t border-stone-200 align-top">
                  <th className="px-3 py-3 text-left font-medium">
                    {label}
                    <div className="text-xs font-normal text-stone-500">{DOMAIN_FULL_NAME[label]}</div>
                  </th>
                  {compounds.map((compound) => {
                    const cell = compound.domains[label];
                    return (
                      <td key={compound.slug} className="px-3 py-3">
                        <ScoreCell cell={cell} />
                        <div className="mt-1 text-xs text-stone-500">
                          {cell?.humanRelevance ? HUMAN_LABEL[cell.humanRelevance] : "No headline"}
                          {cell?.confidence ? ` · ${CONFIDENCE_LABEL[cell.confidence]}` : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-600">Choose a preset or enter at least two slugs.</p>
      )}
    </main>
  );
}
