import { scoreTone, signedScore } from "~/lib/labels";
import type { DomainCell } from "~/server/atlas/queries";

export function ScoreCell({ cell }: { cell: DomainCell | undefined }) {
  if (!cell) return <span className="text-zinc-400">—</span>;
  const physiological = cell.maximumEvidenceSupportedEffect === null && Boolean(cell.physiologicalMagnitude);
  const label = physiological ? "Phys." : signedScore(cell.maximumEvidenceSupportedEffect);
  return (
    <abbr
      title={cell.summaryText}
      className={`inline-flex min-w-11 items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold no-underline ring-1 ${scoreTone(cell.maximumEvidenceSupportedEffect, physiological)}`}
    >
      {label}
    </abbr>
  );
}
