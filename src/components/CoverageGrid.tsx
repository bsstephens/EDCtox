import Link from "next/link";

import { scoreTone, TRACK_LABEL } from "~/lib/labels";
import type {
  Colouring,
  CoverageCell,
  CoverageColumn,
  CoverageRow,
} from "~/server/atlas/coverageMap";

/**
 * A matrix, not a scatter. A cell's position is (compound, domain) and means nothing else, so
 * there is no distance for a reader to mistake for severity. Nothing on this grid adds up:
 * there is no row total, no column total and no percentage, because a count of assessments is
 * a measure of what EDCtox has done and never a measure of harm.
 */

const SQUARE = "block h-3 w-3 rounded-[2px]";

/** Ordinal ramps use one mid grey at increasing opacity, so they read on both themes. */
const RAMP = [
  "bg-stone-500/15",
  "bg-stone-500/35",
  "bg-stone-500/55",
  "bg-stone-500/75",
  "bg-stone-500/95",
] as const;

const FILL_TONE: Record<CoverageCell["state"], string> = {
  SCORED: "bg-stone-500/80",
  NO_EFFECT: "bg-stone-500/35",
  UNSCORED: "border border-stone-500/70 bg-transparent",
  OUTSIDE_HEADLINE: "border border-dotted border-stone-500/70 bg-transparent",
  CLAIMS_ONLY: "bg-stone-500/20",
  EMPTY: "bg-stone-500/8",
};

const HUMAN_LEVEL: Record<string, number> = {
  H0: 0,
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
};
const CONFIDENCE_LEVEL: Record<string, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

/**
 * Colour applies to assessed cells only. An unassessed cell is never given a colour, because a
 * colour would make an absence of work look like a measurement.
 */
function toneFor(cell: CoverageCell, colouring: Colouring): string {
  if (cell.state === "EMPTY") return FILL_TONE.EMPTY;
  if (cell.state === "CLAIMS_ONLY") return FILL_TONE.CLAIMS_ONLY;
  if (colouring === "fill") return FILL_TONE[cell.state];
  if (cell.state === "UNSCORED" || cell.state === "OUTSIDE_HEADLINE")
    return FILL_TONE[cell.state];

  switch (colouring) {
    case "score":
      return cell.score === null
        ? FILL_TONE.UNSCORED
        : scoreTone(cell.score, false);
    case "human":
      return RAMP[HUMAN_LEVEL[cell.humanRelevance ?? "H0"] ?? 0]!;
    case "confidence":
      return RAMP[CONFIDENCE_LEVEL[cell.confidence ?? "VERY_LOW"] ?? 0]!;
    case "curation":
      return cell.curated ? RAMP[4] : RAMP[1];
    case "evidence":
      return RAMP[Math.min(cell.findingCount, 4)]!;
    default:
      return FILL_TONE[cell.state];
  }
}

function HeaderGroup({
  columns,
  label,
  first,
}: {
  columns: CoverageColumn[];
  label: string;
  first: boolean;
}) {
  return (
    <th
      colSpan={columns.length}
      scope="colgroup"
      className={`px-1 pb-1 text-left text-[10px] leading-tight font-medium whitespace-nowrap text-stone-500 ${first ? "" : "border-l border-stone-300 pl-2"}`}
    >
      {label}
    </th>
  );
}

export function CoverageGrid({
  columns,
  rows,
  colouring,
}: {
  columns: CoverageColumn[];
  rows: CoverageRow[];
  colouring: Colouring;
}) {
  const groups: Array<{ track: string; columns: CoverageColumn[] }> = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    if (last?.track === column.track) last.columns.push(column);
    else groups.push({ track: column.track, columns: [column] });
  }

  const boundary = new Set<number>();
  let seen = 0;
  for (const group of groups) {
    if (seen > 0) boundary.add(seen);
    seen += group.columns.length;
  }

  return (
    <table className="border-separate border-spacing-x-[3px] border-spacing-y-[2px] text-left">
      <caption className="sr-only">
        Which compounds have been assessed in which biological domains. A filled
        cell means an assessment is stored, not that the compound is harmful. An
        empty cell means nobody has looked.
      </caption>
      <thead>
        <tr>
          <td />
          {groups.map((group, index) => (
            <HeaderGroup
              key={group.track}
              columns={group.columns}
              label={TRACK_LABEL[group.track] ?? group.track}
              first={index === 0}
            />
          ))}
        </tr>
        <tr>
          <th scope="col" className="sr-only">
            Compound
          </th>
          {columns.map((column, index) => (
            <th
              key={column.shortLabel}
              scope="col"
              className={`p-0 align-bottom text-[10px] font-medium tracking-tight ${column.contributesToProfile ? "text-stone-700" : "text-stone-500"} ${boundary.has(index) ? "pl-2" : ""}`}
            >
              <Link
                href={`/mechanisms?domain=${column.code}`}
                title={`${column.name}${column.contributesToProfile ? "" : " — stored, and never part of a profile headline"}`}
                className="inline-block rotate-180 pb-1 whitespace-nowrap underline-offset-2 [writing-mode:vertical-rl] hover:underline"
              >
                {column.shortLabel}
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.slug}>
            <th
              scope="row"
              className="max-w-[13rem] truncate pr-2 text-[11px] leading-none font-normal text-stone-700"
            >
              <Link
                href={`/compounds/${row.slug}`}
                className="underline-offset-2 hover:underline"
              >
                {row.displayName}
              </Link>
            </th>
            {columns.map((column, index) => {
              const cell = row.cells[column.shortLabel]!;
              const tone = toneFor(cell, colouring);
              const gap = boundary.has(index) ? "pl-2" : "";
              if (cell.state === "EMPTY") {
                return (
                  <td key={column.shortLabel} className={`cov-empty ${gap}`} />
                );
              }
              return (
                <td key={column.shortLabel} className={`p-0 ${gap}`}>
                  <Link
                    href={`/compounds/${row.slug}#${column.shortLabel}`}
                    title={cell.label}
                    aria-label={cell.label}
                    className={`${SQUARE} ${tone}`}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CoverageLegend({ colouring }: { colouring: Colouring }) {
  const items =
    colouring === "fill"
      ? [
          ["SCORED", "Scored"],
          ["NO_EFFECT", "Assessed, no effect found"],
          ["UNSCORED", "Assessed, deliberately no number"],
          ["OUTSIDE_HEADLINE", "Research-only mechanism"],
          ["CLAIMS_ONLY", "Claims extracted, not assessed"],
          ["EMPTY", "Not assessed"],
        ]
      : [
          ["EMPTY", "Not assessed"],
          ["UNSCORED", "Assessed, no number"],
        ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {items.map(([state, label]) => (
        <li key={state} className="flex items-center gap-1.5">
          <span
            className={`${SQUARE} ${FILL_TONE[state as CoverageCell["state"]]}`}
          />
          {label}
        </li>
      ))}
      {colouring === "score" ? (
        <li className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((score) => (
              <span
                key={score}
                className={`${SQUARE} ${scoreTone(score, false)}`}
              />
            ))}
          </span>
          Protective to disruptive. A signed direction, not a severity rank
        </li>
      ) : null}
      {colouring !== "fill" && colouring !== "score" ? (
        <li className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {RAMP.map((tone) => (
              <span key={tone} className={`${SQUARE} ${tone}`} />
            ))}
          </span>
          Lower to higher
        </li>
      ) : null}
    </ul>
  );
}
