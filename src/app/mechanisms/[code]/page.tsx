import Link from "next/link";
import { notFound } from "next/navigation";

import { CONFIDENCE_LABEL, DIRECTION_LABEL, HUMAN_LABEL, prettyEnum, scoreTone, signedScore } from "~/lib/labels";
import { db } from "~/server/db";
import { loadMechanismDetail, mechanismStatus, type MechanismDetail } from "~/server/mechanisms/query";

export const dynamic = "force-dynamic";

function CountList({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) return <span className="text-stone-500">None recorded</span>;
  return <span>{items.map((item) => `${item.label} ${item.count}`).join(" · ")}</span>;
}

function ClaimTable({ detail }: { detail: MechanismDetail }) {
  if (detail.claims.length === 0) return <p className="text-sm text-stone-600">No claims yet.</p>;
  return (
    <div className="overflow-x-auto rounded border border-stone-300 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="bg-stone-100 text-xs tracking-wide text-stone-600 uppercase">
          <tr>
            <th className="px-3 py-2">Claim</th>
            <th className="px-3 py-2">Paper</th>
            <th className="px-3 py-2">Context</th>
            <th className="px-3 py-2">Directness</th>
            <th className="px-3 py-2">Mapping</th>
          </tr>
        </thead>
        <tbody>
          {detail.claims.map((claim) => (
            <tr key={claim.id} className="border-t border-stone-200 align-top">
              <td className="px-3 py-2">
                <Link href={`/compounds/${claim.compoundSlug}`} className="underline-offset-4 hover:underline">
                  {claim.compoundName}
                </Link>
                <span className="mt-0.5 block">
                  {claim.subjectText} {prettyEnum(claim.relation)} {claim.objectText}
                </span>
                {claim.reviewDerived ? <span className="mt-0.5 block text-xs text-stone-500">Review-derived</span> : null}
                {claim.verifiedSentence ? <span className="mt-1 block text-stone-700">{claim.verifiedSentence}</span> : null}
              </td>
              <td className="px-3 py-2">
                {claim.title}
                <span className="mt-0.5 block text-xs text-stone-500">
                  {claim.year}
                  {claim.pmid ? (
                    <>
                      {" · "}
                      <a className="underline" href={`https://pubmed.ncbi.nlm.nih.gov/${claim.pmid}`} target="_blank" rel="noopener noreferrer">
                        PMID {claim.pmid}
                      </a>
                    </>
                  ) : null}
                  {claim.doi ? (
                    <>
                      {" · "}
                      <a className="underline" href={`https://doi.org/${claim.doi}`} target="_blank" rel="noopener noreferrer">
                        DOI
                      </a>
                    </>
                  ) : null}
                  {" · "}
                  {claim.sourceSection}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-stone-600">
                {[claim.speciesText, claim.tissueText, claim.cellTypeText, claim.doseText].filter(Boolean).join(" · ") || "No species, tissue, cell, or dose text"}
              </td>
              <td className="px-3 py-2">
                {prettyEnum(claim.directness)}
                <span className="mt-0.5 block text-xs text-stone-500">{prettyEnum(claim.confidence)} confidence</span>
              </td>
              <td className="px-3 py-2">
                {prettyEnum(claim.mappingState)}
                <span className="mt-0.5 block text-xs text-stone-500">{claim.curatorVerified ? "Curator verified" : "Machine-extracted"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MechanismDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await loadMechanismDetail(db, code);
  if (!detail) notFound();
  const status = mechanismStatus({
    claimCount: detail.claims.length,
    verifiedClaims: detail.verifiedClaims,
    candidateClaims: detail.candidateClaims,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm">
        <Link className="underline" href="/mechanisms">
          Mechanisms
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{detail.name}</h1>
      <p className="mt-1 text-sm text-stone-500">{detail.code}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{detail.description}</p>
      <p className="mt-2 text-sm text-stone-600">
        {status}. {detail.verifiedClaims === 0 && detail.claims.length > 0 ? "No curator-verified mapping yet. " : ""}
        The supporting sentence stays unlisted until a claim is curator-verified. Claim count does not change a score.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Identity</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Domain", `${detail.domainShortLabel} · ${detail.domainName}${detail.profile ? "" : " · not in the profile score"}`],
            ["Family", detail.familyName ?? "No family"],
            ["Aggregation group", detail.aggregationGroup],
            ["Score policy", prettyEnum(detail.scorePolicy)],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-stone-300 bg-white p-3">
              <dt className="text-stone-500">{label}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Hierarchy</h2>
        <div className="mt-2 rounded border border-stone-300 bg-white p-3 text-sm">
          <p>
            Parent:{" "}
            {detail.parent ? (
              <Link className="underline" href={`/mechanisms/${detail.parent.code}`}>
                {detail.parent.name}
              </Link>
            ) : (
              "none"
            )}
          </p>
          {detail.children.length > 0 ? (
            <ul className="mt-2 space-y-1 border-l border-stone-300 pl-3">
              {detail.children.map((child) => (
                <li key={child.code}>
                  <Link className="underline" href={`/mechanisms/${child.code}`}>
                    {child.name}
                  </Link>
                  <span className="text-stone-500"> · {prettyEnum(child.scorePolicy)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-stone-600">No child mechanisms.</p>
          )}
          {detail.siblings.length > 0 ? (
            <p className="mt-3 text-stone-600">
              Siblings:{" "}
              {detail.siblings.map((sibling, index) => (
                <span key={sibling.code}>
                  {index > 0 ? ", " : ""}
                  <Link className="underline" href={`/mechanisms/${sibling.code}`}>
                    {sibling.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">External mappings</h2>
        {detail.mappings.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No external mapping is stored.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {detail.mappings.map((mapping) => (
              <li key={`${mapping.dataset}-${mapping.termId}`} className="rounded border border-stone-300 bg-white p-3">
                {mapping.dataset}: {mapping.label} · {prettyEnum(mapping.termType)} · {prettyEnum(mapping.mappingType)}
                {mapping.url ? (
                  <>
                    {" "}
                    <a className="underline" href={mapping.url} target="_blank" rel="noopener noreferrer">
                      Source
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Assessments</h2>
        <p className="mt-1 text-sm text-stone-600">These are synthesized judgments. They are separate from the claims below, and the claim count does not set the score.</p>
        {detail.assessments.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No assessment is stored. That is not evidence of no activity.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {detail.assessments.map((assessment) => (
              <li key={assessment.id} className="rounded border border-stone-300 bg-white p-3 text-sm">
                <Link className="font-medium underline" href={`/compounds/${assessment.compoundSlug}`}>
                  {assessment.compoundName}
                </Link>
                <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs ring-1 ${scoreTone(assessment.quantitativeScoreSupported ? assessment.effectScore : null, assessment.effectDirection === "PHYSIOLOGICAL" && assessment.effectScore === null)}`}>
                  {assessment.quantitativeScoreSupported ? signedScore(assessment.effectScore) : "not quantified"}
                </span>
                <p className="mt-1 text-stone-600">
                  {DIRECTION_LABEL[assessment.effectDirection] ?? prettyEnum(assessment.effectDirection)} · {CONFIDENCE_LABEL[assessment.evidenceConfidence] ?? prettyEnum(assessment.evidenceConfidence)} confidence · {HUMAN_LABEL[assessment.humanRelevance] ?? assessment.humanRelevance} · {prettyEnum(assessment.curationStatus)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Claims</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ["Claims", detail.claims.length],
            ["Papers", detail.paperCount],
            ["Curator verified", detail.verifiedClaims],
            ["Candidate mappings", detail.candidateClaims],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded border border-stone-300 bg-white p-2">
              <dt className="text-stone-500">{label}</dt>
              <dd className="text-lg font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-3 space-y-1 text-sm text-stone-700">
          <div>
            <dt className="inline text-stone-500">Directness: </dt>
            <dd className="inline">
              <CountList items={detail.directness} />
            </dd>
          </div>
          <div>
            <dt className="inline text-stone-500">Species: </dt>
            <dd className="inline">
              <CountList items={detail.species} />
            </dd>
          </div>
          <div>
            <dt className="inline text-stone-500">Tissue: </dt>
            <dd className="inline">
              <CountList items={detail.tissues} />
            </dd>
          </div>
          <div>
            <dt className="inline text-stone-500">Cell: </dt>
            <dd className="inline">
              <CountList items={detail.cells} />
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <ClaimTable detail={detail} />
        </div>
      </section>
    </main>
  );
}
