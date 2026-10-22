import type { MachineSuggestion } from "./deterministic";
import { SCREENING_DECISIONS, type ScreeningDecisionName, type ScreeningPurposeName } from "./reasons";

/// One candidate in the dry-run comparison. `existing` is the machine suggestion already stored
/// (the deterministic rules), `curator` the person's decision when one exists, `model` the
/// Claude suggestion from this run. Nothing here is written back.
export type ComparisonRow = {
  evidenceSourceId: string;
  pmid: string | null;
  year: number | null;
  title: string;
  governingPurpose: ScreeningPurposeName | null;
  existing: { decision: string; reasonCode: string | null; confidence: string | null } | null;
  curator: { decision: string; reasonCode: string | null } | null;
  model: MachineSuggestion | null;
  error: string | null;
};

export type DecisionMatrix = Record<ScreeningDecisionName, Record<ScreeningDecisionName, number>>;

export type Agreement = {
  /// Rows where both sides have a decision.
  n: number;
  decisionAgree: number;
  decisionRate: number | null;
  /// Rows where the decisions agree and both sides have a reason code.
  reasonComparable: number;
  reasonAgree: number;
  reasonRate: number | null;
  kappa: number | null;
  /// matrix[reference][model]
  matrix: DecisionMatrix;
};

export type ComparisonSummary = {
  total: number;
  screened: number;
  errors: number;
  modelDecisions: Record<ScreeningDecisionName, number>;
  modelReasons: Record<string, number>;
  versusMachine: Agreement;
  versusCurator: Agreement;
  machineDisagreements: ComparisonRow[];
  curatorDisagreements: ComparisonRow[];
  failures: ComparisonRow[];
};

function isDecision(value: string | null | undefined): value is ScreeningDecisionName {
  return (SCREENING_DECISIONS as readonly string[]).includes(value ?? "");
}

function emptyMatrix(): DecisionMatrix {
  const matrix = {} as DecisionMatrix;
  for (const reference of SCREENING_DECISIONS) {
    matrix[reference] = { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 };
  }
  return matrix;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/// Cohen's kappa over the decision matrix. Null when there is nothing to compare or the
/// expected agreement is already perfect.
export function cohensKappa(matrix: DecisionMatrix): number | null {
  let n = 0;
  let observed = 0;
  const rowTotals: Record<string, number> = {};
  const columnTotals: Record<string, number> = {};
  for (const reference of SCREENING_DECISIONS) {
    for (const model of SCREENING_DECISIONS) {
      const count = matrix[reference][model];
      n += count;
      rowTotals[reference] = (rowTotals[reference] ?? 0) + count;
      columnTotals[model] = (columnTotals[model] ?? 0) + count;
      if (reference === model) observed += count;
    }
  }
  if (n === 0) return null;
  let expected = 0;
  for (const decision of SCREENING_DECISIONS) {
    expected += ((rowTotals[decision] ?? 0) * (columnTotals[decision] ?? 0)) / n;
  }
  const po = observed / n;
  const pe = expected / n;
  if (pe === 1) return null;
  return (po - pe) / (1 - pe);
}

function agreement(
  rows: readonly ComparisonRow[],
  reference: (row: ComparisonRow) => { decision: string; reasonCode: string | null } | null,
): Agreement {
  const matrix = emptyMatrix();
  let n = 0;
  let decisionAgree = 0;
  let reasonComparable = 0;
  let reasonAgree = 0;
  for (const row of rows) {
    const side = reference(row);
    if (!row.model || !side || !isDecision(side.decision)) continue;
    n += 1;
    matrix[side.decision][row.model.decision] += 1;
    if (side.decision !== row.model.decision) continue;
    decisionAgree += 1;
    if (!side.reasonCode) continue;
    reasonComparable += 1;
    if (side.reasonCode === row.model.reasonCode) reasonAgree += 1;
  }
  return {
    n,
    decisionAgree,
    decisionRate: rate(decisionAgree, n),
    reasonComparable,
    reasonAgree,
    reasonRate: rate(reasonAgree, reasonComparable),
    kappa: cohensKappa(matrix),
    matrix,
  };
}

export function summarizeComparison(rows: readonly ComparisonRow[]): ComparisonSummary {
  const modelDecisions: Record<ScreeningDecisionName, number> = { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 };
  const modelReasons: Record<string, number> = {};
  for (const row of rows) {
    if (!row.model) continue;
    modelDecisions[row.model.decision] += 1;
    modelReasons[row.model.reasonCode] = (modelReasons[row.model.reasonCode] ?? 0) + 1;
  }
  return {
    total: rows.length,
    screened: rows.filter((row) => row.model !== null).length,
    errors: rows.filter((row) => row.error !== null).length,
    modelDecisions,
    modelReasons,
    versusMachine: agreement(rows, (row) => row.existing),
    versusCurator: agreement(rows, (row) => row.curator),
    machineDisagreements: rows.filter((row) => row.model && row.existing && row.existing.decision !== row.model.decision),
    curatorDisagreements: rows.filter((row) => row.model && row.curator && row.curator.decision !== row.model.decision),
    failures: rows.filter((row) => row.error !== null),
  };
}

function percent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(0)}%`;
}

function fixed(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function agreementLines(label: string, item: Agreement): string[] {
  if (item.n === 0) return [`No ${label} to compare against.`, ""];
  return [
    `| Measure | Value |`,
    `| --- | --- |`,
    `| Publications with both a ${label} and a model suggestion | ${item.n} |`,
    `| Decision agreement | ${item.decisionAgree} of ${item.n} (${percent(item.decisionRate)}) |`,
    `| Cohen's kappa on decision | ${fixed(item.kappa)} |`,
    `| Reason agreement where the decision agrees | ${item.reasonAgree} of ${item.reasonComparable} (${percent(item.reasonRate)}) |`,
    "",
    `Decision matrix, ${label} down and model across:`,
    "",
    `| ${label} \\ model | INCLUDE | EXCLUDE | UNCERTAIN |`,
    `| --- | --- | --- | --- |`,
    ...SCREENING_DECISIONS.map(
      (reference) => `| ${reference} | ${item.matrix[reference].INCLUDE} | ${item.matrix[reference].EXCLUDE} | ${item.matrix[reference].UNCERTAIN} |`,
    ),
    "",
  ];
}

function describe(row: ComparisonRow): string {
  return `${row.year ?? "?"} pmid ${row.pmid ?? "-"} ${row.title}`;
}

function disagreementLines(label: string, rows: readonly ComparisonRow[], side: (row: ComparisonRow) => string): string[] {
  if (rows.length === 0) return [`None.`, ""];
  const lines: string[] = [];
  for (const row of rows) {
    lines.push(`- **${describe(row)}**`);
    lines.push(`  ${label}: ${side(row)}`);
    lines.push(`  Model: ${row.model?.decision} ${row.model?.reasonCode} ${row.model?.confidence}. ${row.model?.rationale ?? ""}`);
  }
  lines.push("");
  return lines;
}

export function renderComparisonMarkdown(
  summary: ComparisonSummary,
  meta: { promptVersion: string; model: string; servedModels: readonly string[]; transport: string; source: string; ranAt: string },
): string {
  const reasons = Object.entries(summary.modelReasons)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `| ${reason} | ${count} |`);
  return [
    `# Screening dry run: ${meta.promptVersion}`,
    "",
    `Ran ${meta.ranAt} with ${meta.model} through the ${meta.transport} transport against ${meta.source}. Served model${meta.servedModels.length === 1 ? "" : "s"}: ${meta.servedModels.length > 0 ? meta.servedModels.join(", ") : "not reported"}. Nothing was written. The curator's decisions and the stored machine suggestions were read and left as they were.`,
    "",
    `| Count | Value |`,
    `| --- | --- |`,
    `| Candidates read | ${summary.total} |`,
    `| Suggestions returned | ${summary.screened} |`,
    `| Provider errors | ${summary.errors} |`,
    `| Model INCLUDE / EXCLUDE / UNCERTAIN | ${summary.modelDecisions.INCLUDE} / ${summary.modelDecisions.EXCLUDE} / ${summary.modelDecisions.UNCERTAIN} |`,
    "",
    "## Agreement with the stored machine suggestions",
    "",
    ...agreementLines("stored machine suggestion", summary.versusMachine),
    "## Agreement with curator decisions",
    "",
    ...agreementLines("curator decision", summary.versusCurator),
    "## Model reason codes",
    "",
    `| Reason | Count |`,
    `| --- | --- |`,
    ...reasons,
    "",
    "## Disagreements with the stored machine suggestions, for hand reading",
    "",
    ...disagreementLines("Rules", summary.machineDisagreements, (row) => `${row.existing?.decision} ${row.existing?.reasonCode ?? "-"} ${row.existing?.confidence ?? "-"}`),
    "## Disagreements with curator decisions, for hand reading",
    "",
    ...disagreementLines("Curator", summary.curatorDisagreements, (row) => `${row.curator?.decision} ${row.curator?.reasonCode ?? "-"}`),
    "## Provider errors",
    "",
    ...(summary.failures.length === 0 ? ["None.", ""] : summary.failures.flatMap((row) => [`- ${describe(row)}`, `  ${row.error}`]).concat([""])),
  ].join("\n");
}
