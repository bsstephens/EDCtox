import Link from "next/link";

import { prettyEnum } from "~/lib/labels";
import type { CompoundCoverage, CoverageClaim, CoverageState } from "~/server/coverage/query";

const MARK: Record<CoverageState, string> = {
  VERIFIED: "✓",
  CANDIDATE: "~",
  UNMAPPED: "○",
};

function ClaimDetails({ claim }: { claim: CoverageClaim }) {
  const context = [claim.speciesText, claim.tissueText, claim.cellTypeText, claim.doseText].filter(Boolean).join(" · ");
  return (
    <details className="rounded border border-stone-200 bg-stone-50 p-2">
      <summary className="cursor-pointer">
        <span className="font-medium">{MARK[claim.state]}</span> {claim.mechanismName ?? claim.objectText}
        {claim.mechanismCode ? <span className="text-stone-500"> · {claim.mechanismCode}</span> : null}
      </summary>
      <div className="mt-2 space-y-1 text-sm leading-6">
        <p>
          {claim.subjectText} {prettyEnum(claim.relation)} {claim.objectText}
          {claim.reviewDerived ? " · review-derived" : ""}
        </p>
        <p>
          {claim.state === "UNMAPPED" ? "Not mapped to a mechanism." : `Mapped to ${claim.mechanismName}.`} Status {prettyEnum(claim.state)}. Directness {prettyEnum(claim.directness)}.
        </p>
        <p>{claim.curatorVerified ? "Curator verified" : "Machine-extracted"}{claim.machineMechanismCode ? `. Machine suggested ${claim.machineMechanismCode}` : ""}.</p>
        <p>
          {claim.title} · {claim.year}
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
        </p>
        <p className="text-stone-600">{context || "No species, tissue, cell, or dose text"}</p>
      </div>
    </details>
  );
}

export function MechanismCoverage({ coverage }: { coverage: CompoundCoverage }) {
  const { metrics } = coverage;
  return (
    <section className="rounded border border-stone-300 bg-white p-3">
      <h2 className="font-medium">Mechanism coverage</h2>
      <p className="mt-1 text-sm text-stone-600">
        ✓ verified mapping · ~ candidate mapping · ○ unmapped claim. An unmapped claim is not weaker evidence. A seed assessment is not a verified mapping. These counts do not change a score.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          ["Mapped claims", metrics.mapped],
          ["Candidate mappings", metrics.candidate],
          ["Unmapped claims", metrics.unmapped],
          ["Directly demonstrated", metrics.direct],
          ["Curator verified", metrics.verified],
        ].map(([label, value]) => (
          <div key={label} className="rounded bg-stone-50 px-2 py-1">
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {coverage.warnings.map((warning) => (
        <p key={warning} className="mt-3 text-sm text-stone-700">
          {warning}
        </p>
      ))}
      <div className="mt-4 space-y-5">
        {coverage.domains.map((domain) => (
          <div key={domain.domainCode}>
            <h3 className="font-medium">
              {domain.domainShortLabel} · {domain.domainName}
            </h3>
            {domain.families.map((family) => (
              <div key={family.familyName ?? "none"} className="mt-2">
                <p className="text-xs tracking-wide text-stone-500 uppercase">{family.familyName ?? "No family"}</p>
                {family.parents.map((parent) => (
                  <div key={parent.parentCode ?? "none"} className="mt-2 space-y-2">
                    {parent.parentName ? <p className="text-sm text-stone-600">{parent.parentName}</p> : null}
                    {parent.claims.map((claim) => (
                      <div key={claim.id}>
                        {claim.mechanismCode ? (
                          <p className="mb-1 text-sm">
                            <Link className="underline" href={`/mechanisms/${claim.mechanismCode}`}>
                              {claim.mechanismName}
                            </Link>
                          </p>
                        ) : null}
                        <ClaimDetails claim={claim} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {coverage.unmapped.length > 0 ? (
          <div>
            <h3 className="font-medium">Not mapped to a mechanism</h3>
            <p className="mt-1 text-sm text-stone-600">These claims stay off parent mechanisms until a curator maps them to an existing specific mechanism.</p>
            <div className="mt-2 space-y-2">
              {coverage.unmapped.map((claim) => (
                <ClaimDetails key={claim.id} claim={claim} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
