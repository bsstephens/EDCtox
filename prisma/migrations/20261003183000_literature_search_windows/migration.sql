-- Record which result window produced a search run.
-- Existing runs, if any, were newest-first.

ALTER TABLE "LiteratureSearchRun"
    ADD COLUMN "resultWindow" TEXT NOT NULL DEFAULT 'recent',
    ADD COLUMN "sortMode" TEXT NOT NULL DEFAULT 'pub_date';
