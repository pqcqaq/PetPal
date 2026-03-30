import { purgeExpiredCallbackAudits } from '../services/petpal-service';
import { defineCronTimer } from './timer';

const TIMER_ID = 'petpal-callback-audit-retention';

export const createPetPalCallbackAuditRetentionTimer = () =>
  defineCronTimer({
    id: TIMER_ID,
    description: '清理 90 天之前的 PetPal 回调审计记录',
    enabled: true,
    schedule: {
      cronExpression: '20 3 * * *',
      timezone: process.env.TZ || 'Asia/Shanghai',
    },
    async execute() {
      const result = await purgeExpiredCallbackAudits(90);
      console.log(
        `[timer:${TIMER_ID}] deleted=${result.deleted} cutoff=${result.cutoff.toISOString()}`,
      );
    },
  });
