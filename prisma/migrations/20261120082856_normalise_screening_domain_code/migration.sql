-- Screening decisions were keyed on a lowercase workflow domain ("reproductive") from the era
-- when the pipeline ran one compound and one domain at a time. Routing now derives contexts from
-- the ontology and uses the biological domain's short label, so the column held two vocabularies
-- for the same thing and the same context could exist twice under two spellings.
--
-- These rows are machine suggestions only. No curator decision exists on any of them, checked
-- before this was written, and the keyword rules that produced them are superseded by derived
-- screening and recorded in docs/ops/PHASE_4A_SCREENER_REPORT.md. So: drop a legacy row where the
-- same paper and compound already has one under the short label, and rename the rest.
--
-- This affects only databases that ran the one-compound screening desk. Production has no
-- screening decisions at all, so there it does nothing.

DELETE FROM "LiteratureScreeningDecision" legacy
WHERE legacy."domainCode" = 'reproductive'
  AND EXISTS (
    SELECT 1 FROM "LiteratureScreeningDecision" fresh
    WHERE fresh."domainCode" = 'REP'
      AND fresh."evidenceSourceId" = legacy."evidenceSourceId"
      AND fresh."compoundId" = legacy."compoundId"
  );

UPDATE "LiteratureScreeningDecision" SET "domainCode" = 'REP' WHERE "domainCode" = 'reproductive';
