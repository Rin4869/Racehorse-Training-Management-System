-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "damId" TEXT,
ADD COLUMN     "fitnessScore" INTEGER,
ADD COLUMN     "sireId" TEXT;

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "distance" INTEGER,
    "surface" TEXT,
    "prizePool" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "position" INTEGER,
    "time" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Race_date_idx" ON "Race"("date");

-- CreateIndex
CREATE INDEX "RaceEntry_horseId_idx" ON "RaceEntry"("horseId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEntry_raceId_horseId_key" ON "RaceEntry"("raceId", "horseId");

-- CreateIndex
CREATE INDEX "Horse_sireId_idx" ON "Horse"("sireId");

-- CreateIndex
CREATE INDEX "Horse_damId_idx" ON "Horse"("damId");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
