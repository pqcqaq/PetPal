import { env } from '../config/env';
import { purgeExpiredCallbackAudits } from '../services/petpal-service';
import { defineCronTimer } from './timer';

const TIMER_ID = 'petpal-callback-audit-retention';

export const createPetPalCallbackAuditRetentionTimer = () =>
  defineCronTimer({
    id: TIMER_ID,
    description: `清理 ${env.PETPAL_CALLBACK_AUDIT_RETENTION_DAYS} 天之前的 PetPal 回调审计记录`,
    enabled: env.PETPAL_CALLBACK_AUDIT_RETENTION_ENABLED,
    schedule: {
      cronExpression: env.PETPAL_CALLBACK_AUDIT_RETENTION_CRON,
      timezone: process.env.TZ || 'Asia/Shanghai',
    },
    async execute() {
      const result = await purgeExpiredCallbackAudits(env.PETPAL_CALLBACK_AUDIT_RETENTION_DAYS);
      console.log(
        `[timer:${TIMER_ID}] deleted=${result.deleted} cutoff=${result.cutoff.toISOString()}`,
      );
    },
  });
