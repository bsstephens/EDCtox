import Link from "next/link";

import { mechanismFamilies } from "~/data/seeds/gutVascularMechanisms";
import { PROFILE_LABELS, evidenceWording, prettyEnum } from "~/lib/labels";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const year = one(params.year);
  const findings = await api.atlas.evidence({
    compoundSlug: one(params.compound) || undefined,
    mechanismCode: one(params.mechanism) || undefined,
    domain: one(params.domain) || undefined,
    species: one(params.species) || undefined,
    evidenceClass: one(params.evidenceClass) || undefined,
    year: year ? Number(year) : undefined,
    lifeStage: one(params.lifeStage) || undefined,
    studyDesign: one(params.studyDesign) || undefined,
    confidence: one(params.confidence) || undefined,
    sex: one(params.sex) || undefined,
    tissue: one(params.tissue) || undefined,
    studyQuality: one(params.studyQuality) || undefined,
    doseMetricType: one(params.doseMetricType) || undefined,
    mechanismFamily: one(params.family) || undefined,
  });

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">
        The finding is the observation. The source is the document, and one source can support several findings. Wording stays at the level of the study type. A structural seed row is marked and is not counted as literature.
      </p>
      <form className="mt-4 grid gap-3 rounded border border-stone-300 bg-white p-3 text-sm md:grid-cols-3" action="/evidence">
        <Field name="compound" label="Compound slug" value={one(params.compound)} />
        <Field name="mechanism" label="Mechanism code" value={one(params.mechanism)} />
        <label className="flex flex-col gap-1">
          Domain
          <select name="domain" defaultValue={one(params.domain)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {PROFILE_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Mechanism family
          <select name="family" defaultValue={one(params.family)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {mechanismFamilies.map((family) => (
              <option key={family.code} value={family.code}>
                {family.name}
              </option>
            ))}
          </select>
        </label>
        <Field name="species" label="Species" value={one(params.species)} />
        <label className="flex flex-col gap-1">
          Human, animal, or cell
          <select name="evidenceClass" defaultValue={one(params.evidenceClass)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {["IN_VITRO", "CELLULAR", "EX_VIVO", "ANIMAL", "HUMAN_OBSERVATIONAL", "HUMAN_PROSPECTIVE", "RANDOMIZED_TRIAL", "MECHANISTIC_REVIEW"].map((value) => (
              <option key={value} value={value}>
                {prettyEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <Field name="year" label="Publication year" value={year} />
        <label className="flex flex-col gap-1">
          Sex
          <select name="sex" defaultValue={one(params.sex)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {["MALE", "FEMALE", "MIXED", "NOT_APPLICABLE", "UNSPECIFIED"].map((value) => (
              <option key={value} value={value}>
                {prettyEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <Field name="tissue" label="Organ, tissue, or cell" value={one(params.tissue)} />
        <label className="flex flex-col gap-1">
          Study quality
          <select name="studyQuality" defaultValue={one(params.studyQuality)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {["NOT_ASSESSED", "VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"].map((value) => (
              <option key={value} value={value}>
                {prettyEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Dose metric
          <select name="doseMetricType" defaultValue={one(params.doseMetricType)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {["UNKNOWN", "ADMINISTERED_DOSE", "PRESCRIBED_DOSE", "DIETARY_CONCENTRATION", "ENVIRONMENTAL_CONCENTRATION", "SERUM_CONCENTRATION", "URINARY_BIOMARKER"].map((value) => (
              <option key={value} value={value}>
                {prettyEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <Field name="lifeStage" label="Life stage" value={one(params.lifeStage)} />
        <Field name="studyDesign" label="Study design" value={one(params.studyDesign)} />
        <label className="flex flex-col gap-1">
          Assessment confidence
          <select name="confidence" defaultValue={one(params.confidence)} className="rounded border border-stone-300 px-2 py-1">
            <option value="">Any</option>
            {["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"].map((value) => (
              <option key={value} value={value}>
                {prettyEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button className="rounded bg-stone-900 px-3 py-1.5 text-white" type="submit">
            Filter
          </button>
        </div>
      </form>
      <div className="mt-4 space-y-3">
        {findings.length === 0 ? <p className="text-sm text-stone-600">No findings match.</p> : null}
        {findings.map((finding) => (
          <article key={finding.id} className="rounded border border-stone-300 bg-white p-3 text-sm">
            <h2 className="font-medium">{finding.sourceTitle}</h2>
            <p className="text-xs text-stone-500">
              {finding.year} · {finding.journal} · {evidenceWording(finding.evidenceClass)}
              {finding.countsAsScientificEvidence ? "" : " · structural seed, not a citation"}
              {" · "}
              {prettyEnum(finding.sex)} · study quality {prettyEnum(finding.studyQuality)} · {prettyEnum(finding.doseMetricType)}
              {finding.biologicalContextLabel ? ` · ${finding.biologicalContextLabel}` : ""}
            </p>
            <p className="mt-2">
              <Link className="underline" href={`/compounds/${finding.compoundSlug}`}>
                {finding.compoundName}
              </Link>
              {finding.domain ? ` · ${finding.domain}` : ""}
              {finding.mechanism ? ` · ${finding.mechanism}` : ""}
              {finding.outcome ? ` · outcome ${finding.outcome}` : ""}
            </p>
            <p className="mt-2 leading-6">{finding.findingSummary}</p>
            {finding.ourInterpretation ? <p className="mt-1 text-stone-600">{finding.ourInterpretation}</p> : null}
          </article>
        ))}
      </div>
    </main>
  );
}

function Field({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input name={name} defaultValue={value} className="rounded border border-stone-300 px-2 py-1" />
    </label>
  );
}
