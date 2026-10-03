import Link from "next/link";
import { notFound } from "next/navigation";

import { DomainBars } from "~/components/DomainBars";
import { ScoreCell } from "~/components/ScoreCell";
import {
  CONFIDENCE_LABEL,
  DIRECTION_LABEL,
  DOMAIN_FULL_NAME,
  HUMAN_LABEL,
  PROFILE_LABELS,
  evidenceWording,
  prettyEnum,
  signedScore,
} from "~/lib/labels";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

const tabs = [
  ["overview", "Overview"],
  ["mechanisms", "Mechanisms"],
  ["outcomes", "Outcomes"],
  ["evidence", "Evidence"],
  ["exposure", "Exposure"],
  ["interactions", "Interactions"],
  ["regulatory", "Regulatory"],
  ["gaps", "Data gaps"],
] as const;

type Tab = (typeof tabs)[number][0];

export default async function CompoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const compound = await api.atlas.bySlug({ slug });
  if (!compound) notFound();
  const tab: Tab = tabs.some((item) => item[0] === query.tab) ? (query.tab as Tab) : "overview";

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <p className="text-sm text-stone-500">
        <Link href="/" className="hover:underline">
          Compounds
        </Link>
      </p>
      <header className="mt-2 border-b border-stone-300 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{compound.displayName}</h1>
            <p className="mt-1 text-sm text-stone-600">{compound.canonicalName}</p>
          </div>
          <Link
            href={`/compare?slugs=${compound.slug}`}
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm"
          >
            Add to comparison
          </Link>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Category</dt>
            <dd>
              {prettyEnum(compound.compoundType)} · {compound.primaryCategory}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Record</dt>
            <dd>{prettyEnum(compound.recordKind)} · {prettyEnum(compound.currentUseStatus)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Identifiers</dt>
            <dd>
              {compound.casNumber ? `CAS ${compound.casNumber}` : "CAS not curated"}
              {compound.molecularFormula ? ` · ${compound.molecularFormula}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Aliases</dt>
            <dd>{compound.aliases.length ? compound.aliases.map((alias) => alias.name).join(", ") : "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-800">{compound.description}</p>
        {compound.notes ? <p className="mt-2 text-sm text-stone-600">{compound.notes}</p> : null}
        <p className="mt-3 text-xs text-stone-500">
          Flags: {[
            compound.isPharmaceutical ? "pharmaceutical" : null,
            compound.isEndogenous ? "endogenous" : null,
            compound.isEnvironmentalChemical ? "environmental chemical" : null,
            compound.isMixture ? "mixture" : null,
            compound.legacyChemical ? "legacy" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "none"}
          {compound.parent ? (
            <>
              {" "}
              · parent{" "}
              <Link className="underline" href={`/compounds/${compound.parent.slug}`}>
                {compound.parent.displayName}
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Phase-1 numbers are seed hypotheses. They are not curated consensus, not a toxicity total, and not a statement of human risk. Association is not written as causation.
      </div>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={id === "overview" ? `/compounds/${slug}` : `/compounds/${slug}?tab=${id}`}
            className={`rounded px-2 py-1 ${tab === id ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-300"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-5">
        {tab === "overview" ? <Overview compound={compound} /> : null}
        {tab === "mechanisms" ? <Mechanisms compound={compound} /> : null}
        {tab === "outcomes" ? <Outcomes compound={compound} /> : null}
        {tab === "evidence" ? <Evidence compound={compound} /> : null}
        {tab === "exposure" ? <Exposure compound={compound} /> : null}
        {tab === "interactions" ? <Interactions compound={compound} /> : null}
        {tab === "regulatory" ? <Regulatory compound={compound} /> : null}
        {tab === "gaps" ? <Gaps compound={compound} /> : null}
      </section>
    </main>
  );
}

type Compound = NonNullable<Awaited<ReturnType<typeof api.atlas.bySlug>>>;

function Overview({ compound }: { compound: Compound }) {
  return (
    <div className="space-y-6">
      <DomainBars domains={compound.domains} />
      {compound.pathwayNotes.length > 0 ? (
        <div className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">Pathway notes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {compound.pathwayNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {compound.externalIdentifiers.length > 0 || compound.externalRecords.length > 0 || compound.inchiKey || compound.canonicalSmiles ? (
        <section className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">External identifiers</h2>
          <p className="mt-1 text-stone-600">
            These are source keys. A matching identifier does not merge compounds, and it does not change a domain score.
          </p>
          {compound.inchiKey ? <p className="mt-2">InChIKey {compound.inchiKey}</p> : null}
          {compound.canonicalSmiles ? <p className="mt-1 break-all">SMILES {compound.canonicalSmiles}</p> : null}
          <ul className="mt-2 space-y-2">
            {compound.externalIdentifiers.map((identifier) => (
              <li key={`${identifier.namespace}-${identifier.value}`}>
                <span className="font-medium">{prettyEnum(identifier.namespace)}</span> {identifier.value}
                {identifier.datasetName ? ` · ${identifier.datasetName}` : ""}
                {identifier.resolutionStatus ? ` · ${prettyEnum(identifier.resolutionStatus)}` : ""}
                {identifier.verifiedAt ? ` · checked ${identifier.verifiedAt.slice(0, 10)}` : ""}
                {identifier.canonical ? " · canonical" : ""}
                {identifier.disputed ? " · disputed" : ""}
                {identifier.sourceUrl?.startsWith("https://") ? (
                  <a className="ml-2 underline" href={identifier.sourceUrl} rel="noreferrer">
                    Open record
                  </a>
                ) : null}
                {identifier.notes ? <span className="block text-stone-600">{identifier.notes}</span> : null}
              </li>
            ))}
          </ul>
          {compound.externalRecords.length > 0 ? (
            <ul className="mt-3 space-y-1 text-stone-600">
              {compound.externalRecords.map((record) => (
                <li key={`${record.datasetName}-${record.recordType}`}>
                  Cached {record.datasetName}
                  {record.retrievedAt ? ` · retrieved ${record.retrievedAt.slice(0, 10)}` : ""}
                  {record.sourceVersion ? ` · version ${record.sourceVersion}` : ""}
                  {record.stale ? " · stale" : ""}
                  . This cache is not an EDCtox score.
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {PROFILE_LABELS.map((label) => {
          const cell = compound.domains[label];
          if (!cell) return null;
          return (
            <article key={label} className="rounded border border-stone-300 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">
                  {label} · {DOMAIN_FULL_NAME[label]}
                </h2>
                <ScoreCell cell={cell} />
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-700">{cell.summaryText}</p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-stone-500">
                <div>Direction: {DIRECTION_LABEL[cell.dominantDirection] ?? cell.dominantDirection}</div>
                <div>Confidence: {cell.confidence ? CONFIDENCE_LABEL[cell.confidence] : "—"}{cell.confidenceAdjusted ? " (lowered)" : ""}</div>
                <div>Human relevance: {cell.humanRelevance ? HUMAN_LABEL[cell.humanRelevance] : "—"}</div>
                <div>
                  Findings {cell.numberOfSupportingFindings} supporting / {cell.numberOfContradictoryFindings} contradictory · {cell.numberOfCappedObservations} capped
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mechanisms({ compound }: { compound: Compound }) {
  if (compound.domainSections.length === 0) {
    return <p className="text-sm text-stone-600">No mechanism assessments are stored. That is not evidence of no activity.</p>;
  }
  return (
    <div className="space-y-8">
      {compound.domainSections.map((section) => (
        <section key={section.code}>
          <h2 className="text-lg font-medium">
            {section.shortLabel} · {section.name}
            {!section.contributesToProfile ? " (not in the profile score)" : ""}
          </h2>
          <div className="mt-3 space-y-3">
            {section.mechanisms.map((mechanism) => (
              <article key={mechanism.code} className="rounded border border-stone-300 bg-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{mechanism.name}</h3>
                  <p className="text-xs text-stone-500">
                    {mechanism.code} · group {mechanism.aggregationGroup}
                    {mechanism.parentName ? ` · ${mechanism.parentName}` : ""} · {prettyEnum(mechanism.scorePolicy)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-stone-600">{mechanism.description}</p>
                {mechanism.assessments.map((assessment) => (
                  <div key={assessment.id} className="mt-3 border-t border-stone-200 pt-3 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">
                        Score {assessment.quantitativeScoreSupported ? signedScore(assessment.effectScore) : "not quantified"}
                      </span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">{DIRECTION_LABEL[assessment.effectDirection]}</span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">{CONFIDENCE_LABEL[assessment.evidenceConfidence]} confidence</span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">{assessment.humanRelevance}</span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">{prettyEnum(assessment.curationStatus)}</span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">review v{assessment.reviewVersion}</span>
                    </div>
                    {assessment.exposureLabel ? <p className="mt-2 text-stone-600">Exposure: {assessment.exposureLabel}</p> : null}
                    {assessment.biologicalContextLabel ? (
                      <p className="text-stone-600">Biological context: {assessment.biologicalContextLabel}</p>
                    ) : null}
                    {assessment.pathwayName ? <p className="text-stone-600">Pathway: {assessment.pathwayName}. Not summed with other domains.</p> : null}
                    <p className="mt-2 leading-6">{assessment.effectSummary}</p>
                    <p className="mt-1 leading-6 text-stone-700">{assessment.mechanismSummary}</p>
                    <p className="mt-1 text-stone-500">{assessment.limitations}</p>
                    <ul className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                      {assessment.conflictingEvidence ? <li>Conflicting evidence</li> : null}
                      {assessment.insufficientHumanEvidence ? <li>Insufficient human evidence</li> : null}
                      {assessment.doseRelevanceUncertain ? <li>Dose relevance uncertain</li> : null}
                      {assessment.developmentalRelevanceUncertain ? <li>Developmental relevance uncertain</li> : null}
                    </ul>
                    {assessment.findings.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {assessment.findings.map((finding) => (
                          <details key={finding.id} className="rounded bg-stone-50 p-2">
                            <summary className="cursor-pointer">
                              {evidenceWording(finding.evidenceClass)} · {finding.sourceYear} · {finding.sourceTitle}
                              {finding.countsAsScientificEvidence ? "" : " · structural seed, not a citation"}
                            </summary>
                            <p className="mt-2">{finding.findingSummary}</p>
                            {finding.ourInterpretation ? <p className="mt-1 text-stone-600">{finding.ourInterpretation}</p> : null}
                            <p className="mt-1 text-xs text-stone-500">
                              {prettyEnum(finding.sex)} · study quality {prettyEnum(finding.studyQuality)} · dose metric {prettyEnum(finding.doseMetricType)}
                              {finding.biologicalContextLabel ? ` · ${finding.biologicalContextLabel}` : ""}
                            </p>
                            {finding.measurements.length > 0 ? <MeasurementTable rows={finding.measurements} /> : null}
                          </details>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-stone-500">No evidence finding is linked yet.</p>
                    )}
                    {assessment.revisions.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-stone-500">Score history</summary>
                        <ul className="mt-1 space-y-1 text-xs text-stone-600">
                          {assessment.revisions.map((revision) => (
                            <li key={revision.id}>
                              {revision.changedAt.slice(0, 10)}: {signedScore(revision.previousEffectScore)} → {signedScore(revision.newEffectScore)}. {revision.reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Outcomes({ compound }: { compound: Compound }) {
  if (compound.outcomes.length === 0) {
    return <p className="text-sm text-stone-600">No outcome assessments. A mechanism score is not an outcome.</p>;
  }
  return (
    <div className="space-y-3">
      {compound.outcomes.map((outcome) => (
        <article key={outcome.code} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {outcome.name}{" "}
            <span className="font-normal text-stone-500">
              {outcome.quantitativeScoreSupported ? signedScore(outcome.effectScore) : "not quantified"} · {outcome.humanRelevance} · {prettyEnum(outcome.evidenceConfidence)}
            </span>
          </h2>
          {outcome.biologicalContextLabel ? (
            <p className="mt-1 text-stone-600">Biological context: {outcome.biologicalContextLabel}</p>
          ) : null}
          <p className="mt-2 leading-6">{outcome.effectSummary}</p>
          <p className="mt-1 text-stone-500">{outcome.limitations}</p>
        </article>
      ))}
    </div>
  );
}

function Evidence({ compound }: { compound: Compound }) {
  if (compound.evidence.length === 0) {
    return <p className="text-sm text-stone-600">No findings are linked. The publication, when one exists, is not itself the scored unit.</p>;
  }
  return (
    <div className="space-y-3">
      {compound.evidence.map((finding) => (
        <article key={finding.id} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">{finding.sourceTitle}</h2>
          <p className="text-xs text-stone-500">
            {finding.year} · {evidenceWording(finding.evidenceClass)} · {prettyEnum(finding.studyDesign)}
            {finding.countsAsScientificEvidence ? "" : " · not counted as scientific evidence"}
            {" · "}
            {prettyEnum(finding.sex)} · study quality {prettyEnum(finding.studyQuality)}
            {finding.biologicalContextLabel ? ` · ${finding.biologicalContextLabel}` : ""}
          </p>
          <p className="mt-2">{finding.findingSummary}</p>
          {finding.measurements.length > 0 ? <MeasurementTable rows={finding.measurements} /> : null}
          {finding.mechanism ? <p className="mt-1 text-stone-600">Linked mechanism: {finding.mechanism}</p> : null}
          {finding.ourInterpretation ? <p className="mt-1 text-stone-600">{finding.ourInterpretation}</p> : null}
        </article>
      ))}
    </div>
  );
}

function Exposure({ compound }: { compound: Compound }) {
  if (compound.exposures.length === 0) {
    return <p className="text-sm text-stone-600">No exposure context has been entered.</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-stone-300 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-stone-100 text-xs tracking-wide text-stone-600 uppercase">
          <tr>
            <th className="px-3 py-2">Context</th>
            <th className="px-3 py-2">Life stage</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Dose metric</th>
            <th className="px-3 py-2">Real-world relevance</th>
          </tr>
        </thead>
        <tbody>
          {compound.exposures.map((exposure) => (
            <tr key={exposure.contextKey} className="border-t border-stone-200 align-top">
              <td className="px-3 py-2">
                <div className="font-medium">{exposure.population}</div>
                <div className="text-xs text-stone-500">{exposure.notes}</div>
              </td>
              <td className="px-3 py-2">{prettyEnum(exposure.lifeStage)}</td>
              <td className="px-3 py-2">
                {prettyEnum(exposure.exposureType)}
                {exposure.occupational ? " · occupational" : ""}
                {exposure.maternalExposure ? " · maternal" : ""}
              </td>
              <td className="px-3 py-2">{prettyEnum(exposure.doseMetricType)}</td>
              <td className="px-3 py-2">{prettyEnum(exposure.realWorldRelevance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Interactions({ compound }: { compound: Compound }) {
  return (
    <div className="space-y-4">
      {compound.relationships.length === 0 && compound.interactions.length === 0 && compound.transformations.length === 0 ? (
        <p className="text-sm text-stone-600">No relationships or interactions are stored.</p>
      ) : null}
      {compound.relationships.map((relationship) => (
        <article key={`${relationship.type}-${relationship.otherSlug}`} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {prettyEnum(relationship.type)}{" "}
            <Link className="underline" href={`/compounds/${relationship.otherSlug}`}>
              {relationship.otherName}
            </Link>
          </h2>
          <p className="mt-1 text-stone-700">{relationship.description}</p>
        </article>
      ))}
      {compound.interactions.map((interaction) => (
        <article key={`${interaction.interactionType}-${interaction.otherSlug}`} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {prettyEnum(interaction.interactionType)}{" "}
            <Link className="underline" href={`/compounds/${interaction.otherSlug}`}>
              {interaction.otherName}
            </Link>
            {interaction.effectScore !== null ? ` · ${signedScore(interaction.effectScore)}` : ""}
          </h2>
          <p className="mt-1">{interaction.summary}</p>
          <p className="mt-1 text-stone-500">{interaction.limitations}</p>
          <p className="mt-1 text-xs text-stone-500">
            {interaction.confidence} confidence · {interaction.humanRelevance}. Experimental protection is not clinical benefit.
            {interaction.biologicalContextLabel ? ` · ${interaction.biologicalContextLabel}` : ""}
            {interaction.exposureLabel ? ` · ${interaction.exposureLabel}` : ""}
          </p>
        </article>
      ))}
      {compound.transformations.map((transformation) => (
        <article key={transformation.stableKey} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {transformation.role === "parent" ? "Transforms to" : "Formed from"}{" "}
            <Link className="underline" href={`/compounds/${transformation.otherSlug}`}>
              {transformation.otherName}
            </Link>
            {" · "}
            {transformation.transformationType}
          </h2>
          <p className="mt-1 text-stone-700">{transformation.summary}</p>
        </article>
      ))}
    </div>
  );
}

function Regulatory({ compound }: { compound: Compound }) {
  if (compound.regulatory.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No regulatory assessment is stored. A classification from EFSA, EPA, or another agency would appear here as its own layer. It would not replace the mechanistic scores.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {compound.regulatory.map((assessment) => (
        <article key={`${assessment.agency}-${assessment.jurisdiction}`} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {assessment.agency} · {assessment.jurisdiction}
          </h2>
          <p className="mt-1">{prettyEnum(assessment.conclusionKind)} · {assessment.classification}</p>
          {assessment.referenceDose ? (
            <p className="mt-1 text-stone-600">
              {prettyEnum(assessment.referenceDoseKind)} {assessment.referenceDose}
              {assessment.referenceDoseUnit ? ` ${assessment.referenceDoseUnit}` : ""}
              {assessment.criticalEndpoint ? ` · ${assessment.criticalEndpoint}` : ""}
              {assessment.uncertaintyFactor ? ` · uncertainty ${assessment.uncertaintyFactor}` : ""}
              {assessment.populationBasis ? ` · ${assessment.populationBasis}` : ""}
            </p>
          ) : null}
          <p className="mt-1 text-stone-600">{assessment.summary}</p>
        </article>
      ))}
    </div>
  );
}

function MeasurementTable({
  rows,
}: {
  rows: Array<{
    id: string;
    endpoint: string;
    value: string | null;
    unit: string | null;
    pValue: string | null;
    effectSizeType?: string | null;
    analyte?: string | null;
  }>;
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="text-stone-500">
            <th className="py-1 pr-3">Endpoint</th>
            <th className="py-1 pr-3">Value</th>
            <th className="py-1 pr-3">Unit</th>
            <th className="py-1 pr-3">Exact p</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-stone-200">
              <td className="py-1 pr-3">{row.endpoint}</td>
              <td className="py-1 pr-3">{row.value ?? "—"}</td>
              <td className="py-1 pr-3">{row.unit ?? "—"}</td>
              <td className="py-1 pr-3">{row.pValue ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Gaps({ compound }: { compound: Compound }) {
  if (compound.dataGaps.length === 0) {
    return <p className="text-sm text-stone-600">No explicit data gap is recorded.</p>;
  }
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
  const gaps = [...compound.dataGaps].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  return (
    <div className="space-y-3">
      {gaps.map((gap) => (
        <article key={gap.description} className="rounded border border-stone-300 bg-white p-3 text-sm">
          <h2 className="font-medium">
            {gap.priority} · {prettyEnum(gap.reason)}
            {gap.domain ? ` · ${gap.domain}` : ""}
          </h2>
          <p className="mt-1">{gap.description}</p>
          <p className="mt-1 text-stone-600">Suggested research: {gap.suggestedResearch}</p>
        </article>
      ))}
    </div>
  );
}
