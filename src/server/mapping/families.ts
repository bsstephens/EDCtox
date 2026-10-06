import type { Prisma, PrismaClient } from "../../../generated/prisma";

type Store = PrismaClient | Prisma.TransactionClient;

export type FamilyAuditRow = {
  code: string;
  name: string;
  domainCode: string;
  domainName: string;
  domainShortLabel: string;
  domainSort: number;
  familyCode: string | null;
  familyName: string | null;
  parentFamilyCode: string | null;
  parentFamilyName: string | null;
};

export type FamilyAudit = {
  total: number;
  assigned: number;
  missing: number;
  assignable: number;
  intentional: number;
  familyCodes: string[];
  domains: {
    code: string;
    name: string;
    shortLabel: string;
    missing: { code: string; name: string; parentFamilyName: string | null }[];
  }[];
};

export function auditFamilies(rows: readonly FamilyAuditRow[]): FamilyAudit {
  const familyCodes = [...new Set(rows.flatMap((row) => [row.familyCode, row.parentFamilyCode].filter((code): code is string => Boolean(code))))].sort();
  const missing = rows.filter((row) => !row.familyCode);
  const assignableRows = missing.filter((row) => row.parentFamilyCode !== null && familyCodes.includes(row.parentFamilyCode));
  const domains = new Map<string, FamilyAudit["domains"][number] & { sort: number }>();
  for (const row of missing) {
    const existing = domains.get(row.domainCode);
    const domain = existing ?? {
      code: row.domainCode,
      name: row.domainName,
      shortLabel: row.domainShortLabel,
      missing: [],
      sort: row.domainSort,
    };
    if (!existing) domains.set(row.domainCode, domain);
    domain.missing.push({
      code: row.code,
      name: row.name,
      parentFamilyName: row.parentFamilyName,
    });
  }
  return {
    total: rows.length,
    assigned: rows.length - missing.length,
    missing: missing.length,
    assignable: assignableRows.length,
    intentional: missing.length - assignableRows.length,
    familyCodes,
    domains: [...domains.values()]
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((domain) => ({
        code: domain.code,
        name: domain.name,
        shortLabel: domain.shortLabel,
        missing: domain.missing.sort((a, b) => a.code.localeCompare(b.code)),
      })),
  };
}

export async function loadFamilyAudit(store: Store): Promise<FamilyAudit> {
  const rows = await store.mechanism.findMany({
    select: {
      code: true,
      name: true,
      family: { select: { code: true, name: true } },
      parent: { select: { family: { select: { code: true, name: true } } } },
      domain: { select: { code: true, name: true, shortLabel: true, sortOrder: true } },
    },
    orderBy: [{ domain: { sortOrder: "asc" } }, { code: "asc" }],
  });
  return auditFamilies(
    rows.map((row) => ({
      code: row.code,
      name: row.name,
      domainCode: row.domain.code,
      domainName: row.domain.name,
      domainShortLabel: row.domain.shortLabel,
      domainSort: row.domain.sortOrder,
      familyCode: row.family?.code ?? null,
      familyName: row.family?.name ?? null,
      parentFamilyCode: row.parent?.family?.code ?? null,
      parentFamilyName: row.parent?.family?.name ?? null,
    })),
  );
}
