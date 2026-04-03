import { env } from '../config/env';
import { defineIntervalTimer } from './timer';
import { cleanupOrphanManagedAttachments } from './upload-reconcile/cleanup-orphan-managed-attachments';
import { reconcilePendingUploads } from './upload-reconcile/reconcile-pending-uploads';

const TIMER_ID = 'upload-reconcile';

export const createUploadReconcileTimer = () =>
  defineIntervalTimer({
    id: TIMER_ID,
    description: 'pending upload reconciliation and orphan managed attachment cleanup',
    enabled: env.UPLOAD_RECONCILE_ENABLED,
    runImmediately: env.UPLOAD_RECONCILE_RUN_ON_START,
    schedule: {
      minutes: env.UPLOAD_RECONCILE_INTERVAL_MINUTES,
    },
    async execute() {
      const reconcileResult = await reconcilePendingUploads();
      const orphanCleanupResult = await cleanupOrphanManagedAttachments();
      console.log(
        `[timer:${TIMER_ID}] pending checked=${reconcileResult.checked} completed=${reconcileResult.completed} failed=${reconcileResult.failed} pending=${reconcileResult.pending} orphan checked=${orphanCleanupResult.checked} deleted=${orphanCleanupResult.deleted} keptReferenced=${orphanCleanupResult.keptReferenced} blocked=${orphanCleanupResult.blocked}`,
      );
    },
  });
