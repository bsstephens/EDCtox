import {
  NEVER_ASSESSED_LABEL,
  NEVER_ASSESSED_TONE,
  scoreTone,
  signedScore,
  UNSCORED_LABEL,
  UNSCORED_TONE,
} from "~/lib/labels";
import type { DomainCell } from "~/server/atlas/queries";

const BASE =
  "inline-flex min-w-11 items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold no-underline";

/**
 * Three states, never two. A domain nobody has assessed and a domain assessed and deliberately
 * left unscored are different facts, and rendering both as a dash told the reader they were the
 * same. The dash now means "nobody looked" and nothing else.
 */
export function ScoreCell({ cell }: { cell: DomainCell | undefined }) {
  if (!cell || cell.assessedMechanismCount === 0) {
    return (
      <abbr
        title={NEVER_ASSESSED_LABEL}
        className={`${BASE} ${NEVER_ASSESSED_TONE}`}
      >
        —
      </abbr>
    );
  }

  const score = cell.maximumEvidenceSupportedEffect;
  if (score === null) {
    const reason = cell.unscoredReason ?? "NO_NUMBER_JUSTIFIED";
    const wording =
      UNSCORED_LABEL[reason] ?? UNSCORED_LABEL.NO_NUMBER_JUSTIFIED!;
    const physiological = reason === "PHYSIOLOGICAL";
    return (
      <abbr
        title={`${wording.long} ${cell.summaryText}`}
        className={`${BASE} ring-1 ${physiological ? scoreTone(null, true) : UNSCORED_TONE}`}
      >
        {wording.short}
      </abbr>
    );
  }

  return (
    <abbr
      title={cell.summaryText}
      className={`${BASE} ring-1 ${scoreTone(score, false)}`}
    >
      {signedScore(score)}
    </abbr>
  );
}
