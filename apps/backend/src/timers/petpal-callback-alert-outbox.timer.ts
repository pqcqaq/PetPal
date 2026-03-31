import { env } from '../config/env';
import { dispatchPetPalCallbackAlertOutbox } from '../services/petpal-callback-alert-outbox';
import { defineIntervalTimer } from './timer';

const TIMER_ID = 'petpal-callback-alert-outbox';

export const createPetPalCallbackAlertOutboxTimer = () =>
  defineIntervalTimer({
    id: TIMER_ID,
    description: '投递宠托帮回调失败告警 outbox 消息',
    enabled: env.PETPAL_CALLBACK_ALERT_OUTBOX_ENABLED,
    runImmediately: env.PETPAL_CALLBACK_ALERT_OUTBOX_RUN_ON_START,
    schedule: {
      seconds: env.PETPAL_CALLBACK_ALERT_OUTBOX_INTERVAL_SECONDS,
    },
    async execute() {
      const result = await dispatchPetPalCallbackAlertOutbox({
        batchSize: env.PETPAL_CALLBACK_ALERT_OUTBOX_BATCH_SIZE,
      });
      console.log(
        `[timer:${TIMER_ID}] checked=${result.checked} sent=${result.sent} failed=${result.failed} dead=${result.dead}`,
      );
    },
  });
