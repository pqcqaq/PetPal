-- AlterEnum
ALTER TYPE "OrderTimelineEventType" ADD VALUE 'DISPUTED';

-- CreateEnum
CREATE TYPE "ComplaintTargetRole" AS ENUM ('CAREGIVER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('SAFETY', 'FEE', 'SERVICE', 'FRAUD', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintActionType" AS ENUM ('OPEN', 'ASSIGN', 'INVESTIGATE', 'CALL_USER', 'PENALTY', 'CLOSE');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "orderId" TEXT NOT NULL,
    "complainantId" TEXT NOT NULL,
    "targetRole" "ComplaintTargetRole" NOT NULL,
    "complaintType" "ComplaintType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" JSONB,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resultSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintProcessLog" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "complaintId" TEXT NOT NULL,
    "actionType" "ComplaintActionType" NOT NULL,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "ComplaintProcessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_orderId_createdAt_idx" ON "Complaint"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_complainantId_status_idx" ON "Complaint"("complainantId", "status");

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_targetRole_createdAt_idx" ON "Complaint"("targetRole", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_complaintType_createdAt_idx" ON "Complaint"("complaintType", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_deleteAt_idx" ON "Complaint"("deleteAt");

-- CreateIndex
CREATE INDEX "ComplaintProcessLog_complaintId_createdAt_idx" ON "ComplaintProcessLog"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintProcessLog_operatorId_createdAt_idx" ON "ComplaintProcessLog"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintProcessLog_actionType_createdAt_idx" ON "ComplaintProcessLog"("actionType", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintProcessLog_deleteAt_idx" ON "ComplaintProcessLog"("deleteAt");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_complainantId_fkey" FOREIGN KEY ("complainantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintProcessLog" ADD CONSTRAINT "ComplaintProcessLog_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintProcessLog" ADD CONSTRAINT "ComplaintProcessLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
