import { DOMAIN_FULL_NAME, PROFILE_LABELS, signedScore } from "~/lib/labels";
import type { DomainCell } from "~/server/atlas/queries";

export function DomainBars({ domains }: { domains: Record<string, DomainCell> }) {
  return (
    <div className="space-y-3">
      {PROFILE_LABELS.map((label) => {
        const cell = domains[label];
        const score = cell?.maximumEvidenceSupportedEffect ?? null;
        const physiological = score === null && Boolean(cell?.physiologicalMagnitude);
        const magnitude = score === null ? 0 : Math.abs(score) / 4;
        return (
          <div key={label} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm">
            <div>
              <div className="font-medium text-stone-900">{label}</div>
              <div className="text-xs text-stone-500">{DOMAIN_FULL_NAME[label]}</div>
            </div>
            <div className="relative h-3 rounded bg-stone-200">
              <div className="absolute top-0 left-1/2 h-full w-px bg-stone-500" />
              {score !== null && score !== 0 ? (
                <div
                  className={`absolute top-0 h-full rounded ${score < 0 ? "bg-teal-700" : "bg-orange-800"}`}
                  style={{
                    width: `${magnitude * 50}%`,
                    left: score < 0 ? `${50 - magnitude * 50}%` : "50%",
                  }}
                />
              ) : null}
            </div>
            <div className="text-right font-medium tabular-nums text-stone-900">
              {physiological ? "Phys." : signedScore(score)}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-stone-500">
        Left of the centre line is protective or restorative. Right is disruptive. Physiological activity is labelled and is not drawn as disruption. Domains are not added together.
      </p>
    </div>
  );
}
