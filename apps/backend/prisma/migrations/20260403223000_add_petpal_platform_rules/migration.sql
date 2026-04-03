-- CreateEnum
CREATE TYPE "PlatformRuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "PlatformRule" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "status" "PlatformRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "PlatformRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRule_ruleCode_ruleVersion_key" ON "PlatformRule"("ruleCode", "ruleVersion");

-- CreateIndex
CREATE INDEX "PlatformRule_ruleCode_idx" ON "PlatformRule"("ruleCode");

-- CreateIndex
CREATE INDEX "PlatformRule_status_effectiveAt_idx" ON "PlatformRule"("status", "effectiveAt");

-- CreateIndex
CREATE INDEX "PlatformRule_deleteAt_idx" ON "PlatformRule"("deleteAt");

-- AddForeignKey
ALTER TABLE "PlatformRule"
ADD CONSTRAINT "PlatformRule_createId_fkey"
FOREIGN KEY ("createId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRule"
ADD CONSTRAINT "PlatformRule_updateId_fkey"
FOREIGN KEY ("updateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
