import type { PaginatedResult } from './common';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';
export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type PetServiceType = 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
export type ServiceRequestStatus = 'OPEN' | 'MATCHING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type OrderStatus =
  | 'PENDING_ACCEPT'
  | 'ACCEPTED'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PARTIAL_REFUNDED'
  | 'REFUNDED';
export type PaymentBizType = 'DEPOSIT' | 'TAIL' | 'ADJUSTMENT';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CLOSED';
export type RefundType = 'OWNER_CANCEL' | 'SERVICE_EXCEPTION' | 'DISPUTE';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';

type AmountValue = number | string;

export interface PetProfileRecord {
  id: string;
  ownerId: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  gender: PetGender;
  weightKg: AmountValue | null;
  neutered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetPayload {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  weightKg?: number;
  neutered?: boolean;
}

export interface ServiceRequestRecord {
  id: string;
  ownerId: string;
  petId: string;
  serviceType: PetServiceType;
  startTime: string;
  endTime: string;
  locationText: string;
  locationLat: AmountValue | null;
  locationLng: AmountValue | null;
  budgetAmount: AmountValue | null;
  demandTags: unknown;
  status: ServiceRequestStatus;
  matchedCaregiverId: string | null;
  createdAt: string;
  updatedAt: string;
  pet?: {
    id: string;
    name: string;
    species: PetSpecies;
  };
  matchedCaregiver?: {
    id: string;
    user: {
      id: string;
      nickname: string;
    };
  } | null;
}

export interface CreateServiceRequestPayload {
  petId: string;
  serviceType: PetServiceType;
  startTime: string;
  endTime: string;
  locationText: string;
  locationLat?: number;
  locationLng?: number;
  budgetAmount?: number;
  demandTags?: string[];
}

export interface PaymentRecordBrief {
  id: string;
  payNo: string;
  bizType: PaymentBizType;
  payStatus: PaymentStatus;
  payAmount: AmountValue;
  paidAt: string | null;
}

export interface RefundRecordBrief {
  id: string;
  refundNo: string;
  refundType: RefundType;
  refundStatus: RefundStatus;
  refundAmount: AmountValue;
  reviewedAt: string | null;
}

export interface OrderRecord {
  id: string;
  orderNo: string;
  ownerId: string;
  caregiverId: string;
  serviceRequestId: string | null;
  serviceType: PetServiceType;
  appointmentStart: string;
  appointmentEnd: string;
  amountTotal: AmountValue;
  amountAdjusted: AmountValue;
  amountPaid: AmountValue;
  amountRefunded: AmountValue;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  payments: PaymentRecordBrief[];
  refunds: RefundRecordBrief[];
}

export type OrderDetailRecord = OrderRecord;

export interface MatchCaregiverQuery {
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  city?: string;
  lat?: number;
  lng?: number;
  page?: number;
  pageSize?: number;
}

export interface MatchedCaregiverRecord {
  serviceId: string;
  caregiverId: string;
  caregiverName: string;
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  pricePerUnit: AmountValue;
  unitType: string;
  city: string | null;
  distanceKm: number | null;
  ratingAvg: AmountValue;
  ratingCount: number;
}

export type MatchedCaregiverPage = PaginatedResult<MatchedCaregiverRecord>;
