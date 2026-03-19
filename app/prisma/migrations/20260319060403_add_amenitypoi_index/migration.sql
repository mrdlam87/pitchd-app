-- CreateIndex
CREATE INDEX "AmenityPOI_amenityTypeId_lat_lng_idx" ON "AmenityPOI"("amenityTypeId", "lat", "lng");
