-- A claim's stableKey decides what a re-extraction updates rather than duplicates. It did not
-- name the producer, so when the model-backed extractor read a relationship the rule-based one
-- had already stored, it updated that row and took over its provenance: five rule-based claims
-- were absorbed that way on the first real run, and re-running the rule-based pilot would have
-- converted them straight back. The two extractors can now hold a row each, which is what lets
-- them be compared at all.
--
-- The producer namespaces the key instead of joining the hash, so this is a prefix rewrite and
-- not a recomputation. That matters: the hash of a model claim was built from the object's head,
-- which is not stored, so it cannot be recomputed from the row.
--
-- Expand-only in the sense that matters here: no column changes and no row is added or removed.
-- Every key keeps its hash and gains the namespace its own provider column already states.
UPDATE "MechanisticClaim"
SET "stableKey" = 'claim:' || "provider" || ':' || substring("stableKey" FROM 7)
WHERE "stableKey" LIKE 'claim:%'
  AND "stableKey" NOT LIKE 'claim:' || "provider" || ':%';
