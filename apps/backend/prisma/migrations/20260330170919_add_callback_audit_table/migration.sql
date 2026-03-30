-- CreateTable
CREATE TABLE "CallbackAudit" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "callbackType" TEXT NOT NULL DEFAULT 'PAYMENT_CALLBACK',
    "paymentId" TEXT,
    "refundId" TEXT,
    "requestId" TEXT NOT NULL,
    "sourceMode" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "signatureDigest" TEXT,
    "callbackTimestamp" TEXT,
    "callbackStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationResult" TEXT,
    "rawPayload" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallbackAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallbackAudit_requestId_key" ON "CallbackAudit"("requestId");

-- CreateIndex
CREATE INDEX "CallbackAudit_requestId_idx" ON "CallbackAudit"("requestId");

-- CreateIndex
CREATE INDEX "CallbackAudit_callbackType_callbackStatus_idx" ON "CallbackAudit"("callbackType", "callbackStatus");

-- CreateIndex
CREATE INDEX "CallbackAudit_paymentId_idx" ON "CallbackAudit"("paymentId");

-- CreateIndex
CREATE INDEX "CallbackAudit_refundId_idx" ON "CallbackAudit"("refundId");

-- CreateIndex
CREATE INDEX "CallbackAudit_createdAt_idx" ON "CallbackAudit"("createdAt");

-- CreateIndex
CREATE INDEX "CallbackAudit_sourceMode_idx" ON "CallbackAudit"("sourceMode");

-- AddForeignKey
ALTER TABLE "CallbackAudit" ADD CONSTRAINT "CallbackAudit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackAudit" ADD CONSTRAINT "CallbackAudit_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "RefundRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
