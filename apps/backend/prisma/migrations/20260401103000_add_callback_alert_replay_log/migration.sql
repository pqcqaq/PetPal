-- CreateTable
CREATE TABLE "CallbackAlertReplayLog" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "callbackOutboxId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'REQUEUE',
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackAlertReplayLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallbackAlertReplayLog_callbackOutboxId_createdAt_idx" ON "CallbackAlertReplayLog"("callbackOutboxId", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackAlertReplayLog_actorId_idx" ON "CallbackAlertReplayLog"("actorId");

-- AddForeignKey
ALTER TABLE "CallbackAlertReplayLog" ADD CONSTRAINT "CallbackAlertReplayLog_callbackOutboxId_fkey" FOREIGN KEY ("callbackOutboxId") REFERENCES "CallbackAlertOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
