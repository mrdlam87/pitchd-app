-- CreateIndex
CREATE INDEX "Campsite_syncStatus_lat_lng_idx" ON "Campsite"("syncStatus", "lat", "lng");
