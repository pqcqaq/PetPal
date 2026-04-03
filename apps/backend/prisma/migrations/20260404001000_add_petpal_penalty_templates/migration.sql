-- CreateTable
CREATE TABLE "PenaltyTemplate" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "description" TEXT,
    "targetRole" "ComplaintTargetRole",
    "penaltyType" "PenaltyType" NOT NULL,
    "severity" "PenaltySeverity" NOT NULL,
    "defaultReason" TEXT NOT NULL,
    "actionSummary" TEXT NOT NULL,
    "defaultRectifyDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "PenaltyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyTemplate_templateCode_key" ON "PenaltyTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "PenaltyTemplate_targetRole_isActive_idx" ON "PenaltyTemplate"("targetRole", "isActive");

-- CreateIndex
CREATE INDEX "PenaltyTemplate_penaltyType_severity_idx" ON "PenaltyTemplate"("penaltyType", "severity");

-- CreateIndex
CREATE INDEX "PenaltyTemplate_isActive_updatedAt_idx" ON "PenaltyTemplate"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "PenaltyTemplate_lastUsedAt_idx" ON "PenaltyTemplate"("lastUsedAt");

-- CreateIndex
CREATE INDEX "PenaltyTemplate_deleteAt_idx" ON "PenaltyTemplate"("deleteAt");

-- AddForeignKey
ALTER TABLE "PenaltyTemplate"
ADD CONSTRAINT "PenaltyTemplate_createId_fkey"
FOREIGN KEY ("createId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyTemplate"
ADD CONSTRAINT "PenaltyTemplate_updateId_fkey"
FOREIGN KEY ("updateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
