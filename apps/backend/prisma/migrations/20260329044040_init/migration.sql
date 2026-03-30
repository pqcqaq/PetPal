-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Role_isDefault_idx" ON "Role"("isDefault");
