/** Future bulk-reference imports. No importer is implemented in this phase. */

export type SnapshotMetadata = {
  providerCode: string;
  sourceVersion: string | null;
  snapshotDate: string | null;
  rowCount: number | null;
};

export type SnapshotMatch = {
  localSlug: string;
  externalId: string | null;
  status: "MATCHED" | "AMBIGUOUS" | "UNMATCHED";
  reason: string;
};

export type ImportPreview = {
  matches: SnapshotMatch[];
  wouldCreateCompounds: false;
};

export type ImportResult = {
  applied: boolean;
  recordsWritten: number;
};

export type SnapshotProviderAdapter = {
  providerCode: string;
  inspectSnapshot(file: Buffer | string): Promise<SnapshotMetadata>;
  matchExistingCompounds(file: Buffer | string, slugs: string[]): Promise<SnapshotMatch[]>;
  previewImport(file: Buffer | string, slugs: string[]): Promise<ImportPreview>;
  applyImport(file: Buffer | string, slugs: string[]): Promise<ImportResult>;
};
