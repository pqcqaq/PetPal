-- AlterTable
ALTER TABLE "CaregiverProfile" ADD COLUMN     "qualificationMaterials" JSONB,
ADD COLUMN     "serviceCommitment" TEXT,
ADD COLUMN     "specialtyTags" JSONB;

-- AlterTable
ALTER TABLE "PetProfile" ADD COLUMN     "allergyNote" TEXT,
ADD COLUMN     "medicalNote" TEXT;

-- CreateTable
CREATE TABLE "OrderConversation" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "orderId" TEXT NOT NULL,
    "ownerUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "caregiverUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OrderConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "conversationId" TEXT NOT NULL,
    "senderRole" "OrderOperatorRole" NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderConversation_orderId_key" ON "OrderConversation"("orderId");

-- CreateIndex
CREATE INDEX "OrderConversation_lastMessageAt_idx" ON "OrderConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "OrderConversation_deleteAt_idx" ON "OrderConversation"("deleteAt");

-- CreateIndex
CREATE INDEX "OrderMessage_conversationId_createdAt_idx" ON "OrderMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderMessage_senderUserId_createdAt_idx" ON "OrderMessage"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderMessage_senderRole_createdAt_idx" ON "OrderMessage"("senderRole", "createdAt");

-- CreateIndex
CREATE INDEX "OrderMessage_deleteAt_idx" ON "OrderMessage"("deleteAt");

-- AddForeignKey
ALTER TABLE "OrderConversation" ADD CONSTRAINT "OrderConversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "OrderConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
