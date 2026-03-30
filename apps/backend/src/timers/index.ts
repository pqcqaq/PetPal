import { createTimerRegistry } from './timer';
import { createOAuthUpstreamRefreshTimer } from './oauth-upstream-refresh.timer';
import { createPetPalCallbackAuditRetentionTimer } from './petpal-callback-audit-retention.timer';
import { createRequestAuditRetentionTimer } from './request-audit-retention.timer';
import { createUploadReconcileTimer } from './upload-reconcile.timer';

export const createBackendTimerRegistry = () =>
  createTimerRegistry([
    createOAuthUpstreamRefreshTimer(),
    createPetPalCallbackAuditRetentionTimer(),
    createRequestAuditRetentionTimer(),
    createUploadReconcileTimer(),
  ]);
