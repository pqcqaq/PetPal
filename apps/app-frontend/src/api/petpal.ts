import type {
  CreatePetPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
} from '@rbac/api-common'
import { appApi } from './client'

export function listPets() {
  return appApi.petpal.pets.list()
}

export function createPet(payload: CreatePetPayload) {
  return appApi.petpal.pets.create(payload)
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

export function matchCaregivers(query: MatchCaregiverQuery) {
  return appApi.petpal.match.caregivers(query)
}
