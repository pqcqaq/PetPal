export type PetPalAdminNavItem = {
  title: string;
  caption: string;
  description: string;
  to: string;
  icon: string;
  permission?: string;
  permissionsAny?: string[];
};

export const petpalAdminNavItems: PetPalAdminNavItem[] = [
  {
    title: '后台总览',
    caption: 'Direct Hub',
    description: '跳过菜单树，直接查看当前账号可进入的 PetPal 后台工作区。',
    to: '/petpal-admin',
    icon: 'i-carbon-dashboard',
  },
  {
    title: '投诉工单',
    caption: 'Complaints',
    description: '集中处理投诉分派、批量结案和 SLA 风险工单。',
    to: '/petpal-admin/complaints',
    icon: 'i-carbon-warning',
    permission: 'petpal.complaint.manage',
  },
  {
    title: '平台规则',
    caption: 'Rules',
    description: '维护服务标准草稿、发布版本和生效时间。',
    to: '/petpal-admin/rules',
    icon: 'i-carbon-book',
    permission: 'petpal.rule.read',
  },
  {
    title: '违规处罚',
    caption: 'Penalties',
    description: '跟踪处罚记录、整改状态和逾期整改事项。',
    to: '/petpal-admin/penalties',
    icon: 'i-carbon-rule',
    permissionsAny: ['petpal.penalty.read', 'petpal.penalty.manage'],
  },
  {
    title: '照料者审核',
    caption: 'Caregiver Audit',
    description: '审核照料者资质、查看审核状态与处理进度。',
    to: '/petpal-admin/caregiver-audits',
    icon: 'i-carbon-badge',
    permission: 'petpal.caregiver.audit',
  },
  {
    title: '回调审计',
    caption: 'Callback Audit',
    description: '查看支付与退款回调链路、导出审计记录。',
    to: '/petpal-admin/callback-audits',
    icon: 'i-carbon-data-check',
    permission: 'petpal.callback-audit.read',
  },
  {
    title: '告警队列',
    caption: 'Alert Outbox',
    description: '跟踪回调告警重放、失败重试和异常积压。',
    to: '/petpal-admin/callback-alert-outbox',
    icon: 'i-carbon-warning-alt',
    permission: 'petpal.callback-alert.read',
  },
];

export const canAccessPetPalAdminNavItem = (
  permissions: string[],
  item: Pick<PetPalAdminNavItem, 'permission' | 'permissionsAny'>,
) => (
  (!item.permission || permissions.includes(item.permission))
  && (!item.permissionsAny?.length || item.permissionsAny.some((permission) => permissions.includes(permission)))
);
