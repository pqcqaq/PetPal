-- CreateEnum
CREATE TYPE "PenaltyAppealStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "PenaltyRecord"
ADD COLUMN "appealStatus" "PenaltyAppealStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "appealReason" TEXT,
ADD COLUMN "appealSubmittedAt" TIMESTAMP(3),
ADD COLUMN "appealSubmittedById" TEXT,
ADD COLUMN "appealReviewedAt" TIMESTAMP(3),
ADD COLUMN "appealReviewedById" TEXT,
ADD COLUMN "appealReviewNote" TEXT;

-- CreateIndex
CREATE INDEX "PenaltyRecord_appealStatus_appealSubmittedAt_idx" ON "PenaltyRecord"("appealStatus", "appealSubmittedAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_appealSubmittedById_idx" ON "PenaltyRecord"("appealSubmittedById");

-- CreateIndex
CREATE INDEX "PenaltyRecord_appealReviewedById_idx" ON "PenaltyRecord"("appealReviewedById");

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_appealSubmittedById_fkey"
FOREIGN KEY ("appealSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_appealReviewedById_fkey"
FOREIGN KEY ("appealReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
