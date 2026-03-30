-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('DOG', 'CAT', 'OTHER');

-- CreateEnum
CREATE TYPE "PetGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CaregiverAuditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PetServiceType" AS ENUM ('BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING_ACCEPT',
  'ACCEPTED',
  'SERVING',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'PARTIAL_REFUNDED',
  'REFUNDED'
);

-- CreateEnum
CREATE TYPE "PaymentBizType" AS ENUM ('DEPOSIT', 'BALANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "PetProfile" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "species" "PetSpecies" NOT NULL,
  "breed" TEXT,
  "gender" "PetGender" NOT NULL DEFAULT 'UNKNOWN',
  "birthday" TIMESTAMP(3),
  "weightKg" DECIMAL(5,2),
  "neutered" BOOLEAN NOT NULL DEFAULT false,
  "temperamentTags" JSONB,
  "feedingNote" TEXT,
  "emergencyContact" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "PetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverProfile" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "userId" TEXT NOT NULL,
  "intro" TEXT,
  "experienceYears" INTEGER NOT NULL DEFAULT 0,
  "serviceRadiusKm" INTEGER NOT NULL DEFAULT 5,
  "serviceCity" TEXT,
  "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "auditStatus" "CaregiverAuditStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "CaregiverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverService" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "caregiverId" TEXT NOT NULL,
  "serviceType" "PetServiceType" NOT NULL,
  "petSpecies" "PetSpecies" NOT NULL,
  "pricePerUnit" DECIMAL(10,2) NOT NULL,
  "unitType" TEXT NOT NULL,
  "minNoticeHours" INTEGER NOT NULL DEFAULT 2,
  "availableSlots" JSONB NOT NULL,
  "serviceCity" TEXT,
  "serviceLat" DECIMAL(9,6),
  "serviceLng" DECIMAL(9,6),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "CaregiverService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "ownerId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "serviceType" "PetServiceType" NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "locationText" TEXT NOT NULL,
  "locationLat" DECIMAL(9,6),
  "locationLng" DECIMAL(9,6),
  "budgetAmount" DECIMAL(10,2),
  "demandTags" JSONB,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "matchedCaregiverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMain" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "orderNo" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "caregiverId" TEXT NOT NULL,
  "serviceRequestId" TEXT,
  "serviceType" "PetServiceType" NOT NULL,
  "appointmentStart" TIMESTAMP(3) NOT NULL,
  "appointmentEnd" TIMESTAMP(3) NOT NULL,
  "amountTotal" DECIMAL(10,2) NOT NULL,
  "amountAdjusted" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "amountRefunded" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "orderStatus" "OrderStatus" NOT NULL DEFAULT 'PENDING_ACCEPT',
  "cancelReason" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "OrderMain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "orderId" TEXT NOT NULL,
  "payNo" TEXT NOT NULL,
  "bizType" "PaymentBizType" NOT NULL,
  "payChannel" TEXT NOT NULL,
  "payStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payAmount" DECIMAL(10,2) NOT NULL,
  "channelTxnId" TEXT,
  "paidAt" TIMESTAMP(3),
  "channelPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
  "id" TEXT NOT NULL,
  "createId" TEXT,
  "updateId" TEXT,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT,
  "refundNo" TEXT NOT NULL,
  "applyUserId" TEXT NOT NULL,
  "refundType" "RefundType" NOT NULL,
  "refundReason" TEXT NOT NULL,
  "refundAmount" DECIMAL(10,2) NOT NULL,
  "refundStatus" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "channelRefundId" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3),

  CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetProfile_ownerId_idx" ON "PetProfile"("ownerId");
CREATE INDEX "PetProfile_species_idx" ON "PetProfile"("species");
CREATE INDEX "PetProfile_deleteAt_idx" ON "PetProfile"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverProfile_userId_key" ON "CaregiverProfile"("userId");
CREATE INDEX "CaregiverProfile_serviceCity_idx" ON "CaregiverProfile"("serviceCity");
CREATE INDEX "CaregiverProfile_auditStatus_idx" ON "CaregiverProfile"("auditStatus");
CREATE INDEX "CaregiverProfile_deleteAt_idx" ON "CaregiverProfile"("deleteAt");

-- CreateIndex
CREATE INDEX "CaregiverService_caregiverId_idx" ON "CaregiverService"("caregiverId");
CREATE INDEX "CaregiverService_serviceType_petSpecies_idx" ON "CaregiverService"("serviceType", "petSpecies");
CREATE INDEX "CaregiverService_serviceCity_idx" ON "CaregiverService"("serviceCity");
CREATE INDEX "CaregiverService_isActive_idx" ON "CaregiverService"("isActive");
CREATE INDEX "CaregiverService_deleteAt_idx" ON "CaregiverService"("deleteAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_ownerId_status_idx" ON "ServiceRequest"("ownerId", "status");
CREATE INDEX "ServiceRequest_petId_idx" ON "ServiceRequest"("petId");
CREATE INDEX "ServiceRequest_matchedCaregiverId_idx" ON "ServiceRequest"("matchedCaregiverId");
CREATE INDEX "ServiceRequest_startTime_endTime_idx" ON "ServiceRequest"("startTime", "endTime");
CREATE INDEX "ServiceRequest_deleteAt_idx" ON "ServiceRequest"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMain_orderNo_key" ON "OrderMain"("orderNo");
CREATE INDEX "OrderMain_ownerId_orderStatus_idx" ON "OrderMain"("ownerId", "orderStatus");
CREATE INDEX "OrderMain_caregiverId_orderStatus_idx" ON "OrderMain"("caregiverId", "orderStatus");
CREATE INDEX "OrderMain_serviceRequestId_idx" ON "OrderMain"("serviceRequestId");
CREATE INDEX "OrderMain_appointmentStart_appointmentEnd_idx" ON "OrderMain"("appointmentStart", "appointmentEnd");
CREATE INDEX "OrderMain_deleteAt_idx" ON "OrderMain"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_payNo_key" ON "PaymentRecord"("payNo");
CREATE UNIQUE INDEX "PaymentRecord_channelTxnId_key" ON "PaymentRecord"("channelTxnId");
CREATE INDEX "PaymentRecord_orderId_payStatus_idx" ON "PaymentRecord"("orderId", "payStatus");
CREATE INDEX "PaymentRecord_deleteAt_idx" ON "PaymentRecord"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_refundNo_key" ON "RefundRecord"("refundNo");
CREATE UNIQUE INDEX "RefundRecord_channelRefundId_key" ON "RefundRecord"("channelRefundId");
CREATE INDEX "RefundRecord_orderId_refundStatus_idx" ON "RefundRecord"("orderId", "refundStatus");
CREATE INDEX "RefundRecord_paymentId_idx" ON "RefundRecord"("paymentId");
CREATE INDEX "RefundRecord_applyUserId_idx" ON "RefundRecord"("applyUserId");
CREATE INDEX "RefundRecord_deleteAt_idx" ON "RefundRecord"("deleteAt");

-- AddForeignKey
ALTER TABLE "PetProfile" ADD CONSTRAINT "PetProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverProfile" ADD CONSTRAINT "CaregiverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverService" ADD CONSTRAINT "CaregiverService_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_petId_fkey" FOREIGN KEY ("petId") REFERENCES "PetProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_matchedCaregiverId_fkey" FOREIGN KEY ("matchedCaregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMain" ADD CONSTRAINT "OrderMain_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderMain" ADD CONSTRAINT "OrderMain_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderMain" ADD CONSTRAINT "OrderMain_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderMain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_applyUserId_fkey" FOREIGN KEY ("applyUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
