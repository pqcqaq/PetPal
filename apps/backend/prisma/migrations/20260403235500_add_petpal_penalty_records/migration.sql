-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('WARNING', 'SERVICE_RESTRICTION', 'ACCOUNT_SUSPENSION', 'OTHER');

-- CreateEnum
CREATE TYPE "PenaltySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PenaltyRectifyStatus" AS ENUM ('PENDING', 'COMPLETED', 'WAIVED');

-- CreateTable
CREATE TABLE "PenaltyRecord" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "complaintId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "targetRole" "ComplaintTargetRole" NOT NULL,
    "targetUserId" TEXT,
    "penaltyType" "PenaltyType" NOT NULL,
    "severity" "PenaltySeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "actionSummary" TEXT NOT NULL,
    "rectifyStatus" "PenaltyRectifyStatus" NOT NULL DEFAULT 'PENDING',
    "rectifyDueAt" TIMESTAMP(3),
    "rectifiedAt" TIMESTAMP(3),
    "rectifyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "PenaltyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PenaltyRecord_complaintId_createdAt_idx" ON "PenaltyRecord"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_orderId_createdAt_idx" ON "PenaltyRecord"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_targetUserId_createdAt_idx" ON "PenaltyRecord"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_targetRole_createdAt_idx" ON "PenaltyRecord"("targetRole", "createdAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_penaltyType_severity_idx" ON "PenaltyRecord"("penaltyType", "severity");

-- CreateIndex
CREATE INDEX "PenaltyRecord_rectifyStatus_rectifyDueAt_idx" ON "PenaltyRecord"("rectifyStatus", "rectifyDueAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_deleteAt_idx" ON "PenaltyRecord"("deleteAt");

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_complaintId_fkey"
FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_createId_fkey"
FOREIGN KEY ("createId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_updateId_fkey"
FOREIGN KEY ("updateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
