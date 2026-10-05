import Link from "next/link";
import { notFound } from "next/navigation";

import { env } from "~/env";
import { prettyEnum } from "~/lib/labels";
import { CLAIM_PILOT_PMIDS, CLAIM_PROMPT_VERSION } from "~/server/claims/constants";
import { loadStoredClaims } from "~/server/claims/load";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL = {
  AUTO_ACCEPT_LOW_RISK: "Low review priority",
  REVIEW_RECOMMENDED: "Review recommended",
  REVIEW_REQUIRED: "Review required",
} as const;

function rank(pmid: string | null): number {
  const index = pmid ? CLAIM_PILOT_PMIDS.indexOf(pmid as (typeof CLAIM_PILOT_PMIDS)[number]) : -1;
  return index === -1 ? 99 : index;
}

export default async function MechanisticClaimsPage() {
  if (env.NODE_ENV === "production") notFound();
  const claims = await loadStoredClaims(db);
  const groups = new Map<string, { source: (typeof claims)[number]["evidenceSource"]; claims: typeof claims }>();
  for (const claim of claims) {
    const existing = groups.get(claim.evidenceSource.id);
    if (existing) existing.claims.push(claim);
    else groups.set(claim.evidenceSource.id, { source: claim.evidenceSource, claims: [claim] });
  }
  const papers = [...groups.values()].sort((a, b) => rank(a.source.pmid) - rank(b.source.pmid) || b.source.year - a.source.year);
  const verified = claims.filter((claim) => claim.curatorVerified).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm">
        <Link className="underline" href="/admin">
          Curation
        </Link>
        {" · "}
        <Link className="underline" href="/admin/literature">
          Literature screening
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mechanistic claims</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
        Development-only machine claims from stored abstracts for five BPA reproductive papers, extractor {CLAIM_PROMPT_VERSION}. These papers were chosen because the abstract names a specific event. A machine screening include is not treated as screened-in. A claim is not a finding and does not change a score. Low review priority is not scientific acceptance.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Papers", papers.length],
          ["Claims", claims.length],
          ["Candidate mappings", claims.filter((claim) => claim.machineMappingState === "CANDIDATE").length],
          ["Curator verified", verified],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded border border-stone-300 bg-white p-2">
            <dt className="text-stone-500">{label}</dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {papers.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No machine claims are stored yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {papers.map((paper) => (
            <section key={paper.source.id} className="rounded border border-stone-300 bg-white p-3">
              <h2 className="text-base font-medium leading-6">{paper.source.title}</h2>
              <p className="mt-1 text-sm text-stone-600">
                {paper.source.year}
                {paper.source.pmid ? (
                  <>
                    {" · "}
                    <a className="underline" href={`https://pubmed.ncbi.nlm.nih.gov/${paper.source.pmid}`} target="_blank" rel="noopener noreferrer">
                      PMID {paper.source.pmid}
                    </a>
                  </>
                ) : null}
                {paper.source.doi ? (
                  <>
                    {" · "}
                    <a className="underline" href={`https://doi.org/${paper.source.doi}`} target="_blank" rel="noopener noreferrer">
                      DOI
                    </a>
                  </>
                ) : null}
                {" · "}
                Bibliographic status {prettyEnum(paper.source.publicationStatus ?? "unset")}
                {paper.claims.some((claim) => claim.reviewDerived) ? " · Review-derived claims stay inferred" : ""}
              </p>
              <ul className="mt-3 space-y-3">
                {paper.claims.map((claim) => (
                  <li key={claim.id} className="border-t border-stone-200 pt-3 text-sm leading-6">
                    <p className="font-medium">
                      {claim.subjectText} {prettyEnum(claim.relation)} {claim.objectText}
                    </p>
                    <p className="text-stone-700">
                      {prettyEnum(claim.machineDirectness)} · {prettyEnum(claim.machineConfidence)} confidence ·{" "}
                      {claim.mechanism ? `${claim.mechanism.name} (${claim.mechanism.code}), candidate mapping` : "Unmapped"} ·{" "}
                      {PRIORITY_LABEL[claim.reviewPriority]}
                    </p>
                    <p className="text-stone-600">
                      {[claim.speciesText, claim.tissueText, claim.cellTypeText, claim.doseText].filter(Boolean).join(" · ") || "No species, tissue, cell, or dose text"}
                      {claim.measureType ? ` · ${claim.measureType} ${claim.measureValue ?? ""} ${claim.measureUnit ?? ""}` : ""}
                    </p>
                    <p className="text-stone-600">
                      {prettyEnum(claim.textOrigin)} · {claim.sourceSection} · {claim.promptVersion} · Curator verified: {claim.curatorVerified ? "yes" : "no"}
                    </p>
                    <p className="text-stone-600">{claim.machineRationale}</p>
                    {claim.quotedSupport ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-stone-700">Supporting sentence</summary>
                        <p className="mt-1 text-stone-800">{claim.quotedSupport}</p>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
