-- CreateEnum
CREATE TYPE "PenaltyRectifyReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "PenaltyRecord"
ADD COLUMN "rectifyReviewStatus" "PenaltyRectifyReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "rectifyReviewNote" TEXT,
ADD COLUMN "rectifyReviewedAt" TIMESTAMP(3),
ADD COLUMN "rectifyReviewedById" TEXT;

-- CreateIndex
CREATE INDEX "PenaltyRecord_rectifyReviewStatus_updatedAt_idx" ON "PenaltyRecord"("rectifyReviewStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "PenaltyRecord_rectifyReviewedById_idx" ON "PenaltyRecord"("rectifyReviewedById");

-- AddForeignKey
ALTER TABLE "PenaltyRecord"
ADD CONSTRAINT "PenaltyRecord_rectifyReviewedById_fkey"
FOREIGN KEY ("rectifyReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
