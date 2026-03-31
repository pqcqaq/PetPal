import type { AuthClientIdentity } from './auth-client';
import type { LiveMessage } from './rbac';

export const REALTIME_TOPICS = {
  auditEvent: '/system/audit/event',
  chatGlobalMessage: '/chat/global/message',
  petpalCallbackAlert: '/petpal/callback/alert',
  presenceChanged: '/system/presence/changed',
  userRbacUpdated: (userId: string) => `/system/users/${userId}/rbac-updated`,
} as const;

export const REALTIME_SYNC_TARGETS = ['menus', 'user'] as const;
export type RealtimeSyncTarget = (typeof REALTIME_SYNC_TARGETS)[number];

export interface PresenceChangedPayload {
  userId: string;
  nickname: string;
  status: 'online' | 'offline';
  at: string;
}

export interface AuditEventPayload {
  actor: string;
  method: string;
  operationCount: number;
  path: string;
  primaryOperation?: string | null;
  requestId: string;
  statusCode: number;
  createdAt: string;
}

export interface PetPalCallbackAlertPayload {
  callbackAuditId: string;
  callbackStatus: string;
  callbackType: string;
  reason: string;
  requestId: string;
  outboxId: string;
  retryCount: number;
  publishedAt: string;
}

export interface RbacUpdatedPayload {
  reason: string;
  at: string;
  targets: RealtimeSyncTarget[];
}

export interface RealtimeConnectionSnapshot {
  connectionId: string;
  userId: string;
  client: AuthClientIdentity;
  topics: string[];
  connectedAt: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
}

export interface RealtimePublishEnvelope<TPayload = unknown> {
  topic: string;
  payload: TPayload;
  publishedAt: string;
}

export type RealtimeKnownPayload =
  | AuditEventPayload
  | LiveMessage
  | PetPalCallbackAlertPayload
  | PresenceChangedPayload
  | RbacUpdatedPayload;
