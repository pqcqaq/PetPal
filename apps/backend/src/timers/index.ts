import { createTimerRegistry } from './timer';
import { createOAuthUpstreamRefreshTimer } from './oauth-upstream-refresh.timer';
import { createPetPalCallbackAlertOutboxTimer } from './petpal-callback-alert-outbox.timer';
import { createPetPalCallbackAuditRetentionTimer } from './petpal-callback-audit-retention.timer';
import { createRequestAuditRetentionTimer } from './request-audit-retention.timer';
import { createUploadReconcileTimer } from './upload-reconcile.timer';

export const createBackendTimerRegistry = () =>
  createTimerRegistry([
    createOAuthUpstreamRefreshTimer(),
    createPetPalCallbackAlertOutboxTimer(),
    createPetPalCallbackAuditRetentionTimer(),
    createRequestAuditRetentionTimer(),
    createUploadReconcileTimer(),
  ]);
