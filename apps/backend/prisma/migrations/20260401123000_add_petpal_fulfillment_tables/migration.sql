-- CreateEnum
CREATE TYPE "OrderTimelineEventType" AS ENUM (
    'CREATED',
    'ACCEPTED',
    'CHECKED_IN',
    'SERVICE_LOGGED',
    'CHECKED_OUT',
    'COMPLETED',
    'CANCELLED',
    'REFUND_APPLIED',
    'REFUND_DONE'
);

-- CreateEnum
CREATE TYPE "OrderOperatorRole" AS ENUM ('OWNER', 'CAREGIVER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ServiceLogType" AS ENUM (
    'CHECK_IN',
    'FEED',
    'WALK',
    'PLAY',
    'HEALTH',
    'CHECK_OUT',
    'NOTE'
);

-- CreateTable
CREATE TABLE "OrderTimeline" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "orderId" TEXT NOT NULL,
    "eventType" "OrderTimelineEventType" NOT NULL,
    "operatorRole" "OrderOperatorRole" NOT NULL,
    "operatorId" TEXT,
    "eventPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLog" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "orderId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "logType" "ServiceLogType" NOT NULL,
    "textNote" TEXT,
    "mediaUrls" JSONB,
    "geo" JSONB,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "ServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_createdAt_idx" ON "OrderTimeline"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderTimeline_eventType_createdAt_idx" ON "OrderTimeline"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "OrderTimeline_deleteAt_idx" ON "OrderTimeline"("deleteAt");

-- CreateIndex
CREATE INDEX "ServiceLog_orderId_happenedAt_idx" ON "ServiceLog"("orderId", "happenedAt");

-- CreateIndex
CREATE INDEX "ServiceLog_caregiverId_happenedAt_idx" ON "ServiceLog"("caregiverId", "happenedAt");

-- CreateIndex
CREATE INDEX "ServiceLog_logType_idx" ON "ServiceLog"("logType");

-- CreateIndex
CREATE INDEX "ServiceLog_deleteAt_idx" ON "ServiceLog"("deleteAt");

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
