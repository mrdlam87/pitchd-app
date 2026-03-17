-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'beta', 'user');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('active', 'unverified', 'removed');

-- CreateTable
CREATE TABLE "Campsite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "state" TEXT NOT NULL,
    "region" TEXT,
    "blurb" TEXT,
    "bookingRequired" BOOLEAN NOT NULL DEFAULT false,
    "bookingUrl" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmenityType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "AmenityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteAmenity" (
    "campsiteId" TEXT NOT NULL,
    "amenityTypeId" TEXT NOT NULL,

    CONSTRAINT "CampsiteAmenity_pkey" PRIMARY KEY ("campsiteId","amenityTypeId")
);

-- CreateTable
CREATE TABLE "AmenityPOI" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "amenityTypeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmenityPOI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "forecastJson" JSONB NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "parsedIntentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "googleId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campsite_slug_key" ON "Campsite"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityType_key_key" ON "AmenityType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherCache_lat_lng_key" ON "WeatherCache"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "SearchCache_queryHash_key" ON "SearchCache"("queryHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "CampsiteAmenity" ADD CONSTRAINT "CampsiteAmenity_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campsite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteAmenity" ADD CONSTRAINT "CampsiteAmenity_amenityTypeId_fkey" FOREIGN KEY ("amenityTypeId") REFERENCES "AmenityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityPOI" ADD CONSTRAINT "AmenityPOI_amenityTypeId_fkey" FOREIGN KEY ("amenityTypeId") REFERENCES "AmenityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
