import { REALTIME_TOPICS } from '@rbac/api-common';
import type { RealtimeTopicRegistration } from './types';

export const petpalRealtimeTopicRegistrations: RealtimeTopicRegistration[] = [
  {
    code: 'petpal-callback-alert',
    description: '宠托帮回调失败告警广播。',
    name: '宠托帮回调失败告警',
    permissionCode: 'realtime.topic.petpal-callback-alert.subscribe',
    topicPattern: REALTIME_TOPICS.petpalCallbackAlert,
  },
];
