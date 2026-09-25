-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('FIT', 'MONITORING', 'QUARANTINED', 'INJURED');

-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "healthStatus" "HealthStatus" NOT NULL DEFAULT 'FIT';

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN     "photoPath" TEXT;

-- CreateTable
CREATE TABLE "InjuryLocation" (
    "id" TEXT NOT NULL,
    "incidentReportId" TEXT,
    "healthRecordId" TEXT,
    "bodyRegion" TEXT NOT NULL,
    "side" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InjuryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "healthRecordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "healthRecordId" TEXT NOT NULL,
    "treatmentPlanId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InjuryLocation_incidentReportId_idx" ON "InjuryLocation"("incidentReportId");

-- CreateIndex
CREATE INDEX "InjuryLocation_healthRecordId_idx" ON "InjuryLocation"("healthRecordId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_healthRecordId_idx" ON "TreatmentPlan"("healthRecordId");

-- CreateIndex
CREATE INDEX "Medication_healthRecordId_idx" ON "Medication"("healthRecordId");

-- CreateIndex
CREATE INDEX "Medication_treatmentPlanId_idx" ON "Medication"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "Vaccination_horseId_idx" ON "Vaccination"("horseId");

-- CreateIndex
CREATE INDEX "Vaccination_nextDueDate_idx" ON "Vaccination"("nextDueDate");

-- CreateIndex
CREATE INDEX "Horse_healthStatus_idx" ON "Horse"("healthStatus");

-- AddForeignKey
ALTER TABLE "InjuryLocation" ADD CONSTRAINT "InjuryLocation_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryLocation" ADD CONSTRAINT "InjuryLocation_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
