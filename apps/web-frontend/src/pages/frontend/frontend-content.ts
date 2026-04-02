export const frontendNavItems = [
  { label: '首页', to: '/' },
  { label: '主人服务台', to: '/petpal' },
  { label: '照料者工作台', to: '/petpal/caregiver' },
  { label: '提醒', to: '/petpal/reminders' },
  { label: '消息', to: '/petpal/messages' },
  { label: '售后', to: '/petpal/aftersales' },
] as const;

export const projectSignals = [
  { label: '主流程', value: '主人 / 照料者', note: '双角色拆开进入，不再挤在同一页' },
  { label: '服务场景', value: '4 类', note: '寄养、遛宠、喂养、上门陪伴' },
  { label: '透明度', value: '可追溯', note: '订单沟通、服务记录、售后结果全程可回看' },
] as const;

export const capabilityCards = [
  {
    title: '主人侧',
    eyebrow: 'Owner Flow',
    description: '从宠物建档、发需求、下单到售后，全程按任务拆页。',
    bullets: ['宠物、需求、订单、售后四条线分开处理', '支付、评价、投诉都从结果页单独完成'],
  },
  {
    title: '照料者侧',
    eyebrow: 'Caregiver Flow',
    description: '入驻资料、服务清单、履约订单和收益视图独立分流。',
    bullets: ['资料页只做入驻', '服务页只做上架与停用', '履约页只做接单与留痕'],
  },
  {
    title: '后台治理',
    eyebrow: 'Admin Flow',
    description: '后台从前台说明里抽离，直接进入投诉、审核和回调治理。',
    bullets: ['后台走 `/petpal-admin` 根级入口', '不再要求先进入介绍页或菜单树'],
  },
] as const;

export const adminHighlights = [
  { title: '投诉工单', description: '集中处理投诉、结案和 SLA 风险。' },
  { title: '资质审核', description: '快速查看照料者资料和审核状态。' },
  { title: '回调链路', description: '支付、退款和告警队列支持直达排查。' },
] as const;

export const architectureLayers = [
  {
    title: '公开前台',
    summary: '只保留入口、路径说明和必要说明，不再承担长篇介绍。',
    details: ['首页负责入口分流', '认证页负责说明可用登录方式'],
  },
  {
    title: '主人工作台',
    summary: '宠物、需求、订单、消息和售后各自独立。',
    details: ['避免在一个页面里同时建档、下单和售后', '结果页单独承接支付、评价和投诉'],
  },
  {
    title: '照料者工作台',
    summary: '入驻资料、服务上架、履约留痕和收入拆开处理。',
    details: ['资料页不再混入履约动作', '服务页不再叠加订单信息'],
  },
  {
    title: '后台治理',
    summary: '投诉治理、审核和回调审计独立存在。',
    details: ['从公开前台脱离', '权限可控，路径直达'],
  },
] as const;

export const operatingPrinciples = [
  '公开页只负责引导进入办事流，不展示冗长产品介绍。',
  '创建、查看、编辑、售后等动作分到各自页面或结果页，不混杂。',
  '主人和照料者的任务边界分清，不再共享超级工作台。',
  '状态先行，下一步动作前置，让用户一眼知道该去哪里。',
];

export const authStrategies = [
  { title: '用户名密码', code: 'username-password', identifier: '账号', credential: '密码', description: '适合固定账号直接登录。' },
  { title: '邮箱验证码', code: 'email-code', identifier: '邮箱', credential: '验证码', description: '适合需要邮箱确认的账号。' },
  { title: '手机验证码', code: 'phone-code', identifier: '手机号', credential: '验证码', description: '适合移动端和短信触达场景。' },
] as const;

export const authJourney = [
  { title: '选择方式', body: '系统按当前配置展示可用登录方式。' },
  { title: '完成校验', body: '通过密码或验证码完成身份确认。' },
  { title: '进入工作区', body: '登录后按身份进入主人服务台或后台治理入口。' },
] as const;
