ALTER TABLE "Complaint"
ADD COLUMN "assignedAdminId" TEXT;

CREATE INDEX "Complaint_assignedAdminId_status_idx" ON "Complaint"("assignedAdminId", "status");

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_assignedAdminId_fkey"
FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
