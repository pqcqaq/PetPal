-- CreateTable
CREATE TABLE "CallbackAlertOutbox" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "callbackAuditId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'CALLBACK_FAILURE_ALERT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallbackAlertOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallbackAlertOutbox_callbackAuditId_idx" ON "CallbackAlertOutbox"("callbackAuditId");

-- CreateIndex
CREATE INDEX "CallbackAlertOutbox_status_nextRetryAt_idx" ON "CallbackAlertOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "CallbackAlertOutbox_createdAt_idx" ON "CallbackAlertOutbox"("createdAt");

-- AddForeignKey
ALTER TABLE "CallbackAlertOutbox" ADD CONSTRAINT "CallbackAlertOutbox_callbackAuditId_fkey" FOREIGN KEY ("callbackAuditId") REFERENCES "CallbackAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
