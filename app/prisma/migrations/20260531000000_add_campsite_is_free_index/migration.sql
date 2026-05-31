CREATE INDEX IF NOT EXISTS "Campsite_isFree_idx"
  ON "Campsite"("isFree")
  WHERE "isFree" = true;
