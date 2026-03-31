import type {
  CaregiverQualificationMaterialRecord,
  CaregiverOrderPage,
  CaregiverOrderQuery,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  ComplaintRecord,
  CreatePetPayload,
  CreateComplaintPayload,
  CreateOrderMessagePayload,
  CreateOrderReviewPayload,
  CreateServiceLogPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
  OrderConversationDetailRecord,
  OrderConversationRecord,
  OrderRefundProgressRecord,
  OrderDetailRecord,
  UpdatePetPayload,
  UpsertCaregiverProfilePayload,
  UpsertCaregiverServicePayload,
} from '@rbac/api-common'
import { appApi } from './client'

export function listPets() {
  return appApi.petpal.pets.list()
}

export function createPet(payload: CreatePetPayload) {
  return appApi.petpal.pets.create(payload)
}

export function updatePet(id: string, payload: UpdatePetPayload) {
  return appApi.petpal.pets.update(id, payload)
}

export function listServiceRequests() {
  return appApi.petpal.requests.list()
}

export function createServiceRequest(payload: CreateServiceRequestPayload) {
  return appApi.petpal.requests.create(payload)
}

export function listOrders() {
  return appApi.petpal.orders.list()
}

export function getOrderDetail(id: string) {
  return appApi.petpal.orders.detail(id)
}

export function getOrderMessages(id: string): Promise<OrderConversationDetailRecord> {
  return appApi.petpal.orders.messages(id)
}

export function sendOrderMessage(id: string, payload: CreateOrderMessagePayload): Promise<OrderConversationDetailRecord> {
  return appApi.petpal.orders.sendMessage(id, payload)
}

export function markOrderMessagesRead(id: string): Promise<OrderConversationRecord> {
  return appApi.petpal.orders.markMessagesRead(id)
}

export function getOrderRefundProgress(id: string): Promise<OrderRefundProgressRecord> {
  return appApi.petpal.orders.refundProgress(id)
}

export function getOrderComplaints(id: string): Promise<ComplaintRecord[]> {
  return appApi.petpal.orders.complaints(id)
}

export function confirmOrderComplete(id: string): Promise<OrderDetailRecord> {
  return appApi.petpal.orders.confirmComplete(id)
}

export function reviewOrder(id: string, payload: CreateOrderReviewPayload): Promise<OrderDetailRecord> {
  return appApi.petpal.orders.review(id, payload)
}

export function createOrderComplaint(id: string, payload: CreateComplaintPayload): Promise<ComplaintRecord> {
  return appApi.petpal.orders.createComplaint(id, payload)
}

export function matchCaregivers(query: MatchCaregiverQuery) {
  return appApi.petpal.match.caregivers(query)
}

export function getCaregiverProfile(): Promise<CaregiverProfileRecord> {
  return appApi.petpal.caregiver.profile()
}

export function upsertCaregiverProfile(payload: UpsertCaregiverProfilePayload): Promise<CaregiverProfileRecord> {
  return appApi.petpal.caregiver.upsertProfile(payload)
}

export type { CaregiverQualificationMaterialRecord }

export function listCaregiverServices(): Promise<CaregiverServiceRecord[]> {
  return appApi.petpal.caregiver.services()
}

export function createCaregiverService(payload: UpsertCaregiverServicePayload): Promise<CaregiverServiceRecord> {
  return appApi.petpal.caregiver.createService(payload)
}

export function updateCaregiverService(id: string, payload: UpsertCaregiverServicePayload): Promise<CaregiverServiceRecord> {
  return appApi.petpal.caregiver.updateService(id, payload)
}

export function listCaregiverOrders(query?: CaregiverOrderQuery): Promise<CaregiverOrderPage> {
  return appApi.petpal.caregiver.orders(query)
}

export function acceptCaregiverOrder(orderId: string): Promise<OrderDetailRecord> {
  return appApi.petpal.caregiver.acceptOrder(orderId)
}

export function checkInCaregiverOrder(
  orderId: string,
  payload?: { note?: string; geo?: Record<string, unknown> },
): Promise<OrderDetailRecord> {
  return appApi.petpal.caregiver.checkInOrder(orderId, payload)
}

export function addCaregiverServiceLog(
  orderId: string,
  payload: CreateServiceLogPayload,
): Promise<OrderDetailRecord> {
  return appApi.petpal.caregiver.addServiceLog(orderId, payload)
}

export function checkOutCaregiverOrder(
  orderId: string,
  payload?: { note?: string; geo?: Record<string, unknown> },
): Promise<OrderDetailRecord> {
  return appApi.petpal.caregiver.checkOutOrder(orderId, payload)
}
