export const frontendNavItems = [
  { label: 'PetPal 首页', to: '/', eyebrow: '概览' },
  { label: '主人服务台', to: '/petpal', eyebrow: '业务' },
  { label: '照料者工作台', to: '/petpal/caregiver', eyebrow: '履约' },
  { label: '消息中心', to: '/petpal/messages', eyebrow: '沟通' },
  { label: '产品结构', to: '/architecture', eyebrow: '结构' },
  { label: '登录方式', to: '/authentication', eyebrow: '认证' },
] as const;

export const projectSignals = [
  { label: '服务场景', value: '4', note: '寄养、遛宠、喂养、上门陪伴' },
  { label: '双端覆盖', value: 'Web + App', note: '支持后台治理和移动端办事' },
  { label: '信任闭环', value: '可追溯', note: '资质审核、服务记录、退款投诉串成闭环' },
  { label: '后台入口', value: '/petpal-admin', note: 'PetPal 后台可直接进入，不依赖菜单树' },
] as const;

export const capabilityCards = [
  {
    title: '主人服务台',
    eyebrow: 'Owner Flow',
    description: '主人页只承接宠物档案、需求发布、订单跟进和照料者匹配。',
    bullets: ['覆盖宠物、需求、订单、售后主链路', '更重的兼容与导出功能暂时保留在 legacy 路由'],
  },
  {
    title: '照料者工作台',
    eyebrow: 'Caregiver Flow',
    description: '照料者页独立承接入驻资料、服务配置和履约订单，不再混在主人页面里。',
    bullets: ['独立承接档案、服务和接单动作', '更细的资质上传和高级履约先通过 legacy 路由保留'],
  },
  {
    title: '跨订单消息中心',
    eyebrow: 'Message Flow',
    description: '跨订单沟通被提升为独立页面，不必只能进入订单详情后逐条查看。',
    bullets: ['支持按主人/照料者视角聚合会话', '可集中筛选未读并直接跳转订单详情'],
  },
  {
    title: '后台直达治理',
    eyebrow: 'Admin Flow',
    description: 'PetPal 后台从模板菜单里剥离出来，投诉、审核和回调治理可直接进入。',
    bullets: ['根级 `/petpal-admin/*` 直达工作区', '按账号已开通能力显示投诉、审核、回调审计和告警队列'],
  },
  {
    title: '履约与售后留痕',
    eyebrow: 'Traceability',
    description: '从接单、签到、服务记录到退款投诉，全链路都能持续追踪。',
    bullets: ['服务日志支持纯文字和媒体留痕', '退款、投诉、回调与导出链路可审计'],
  },
] as const;

export const adminHighlights = [
  {
    title: '投诉工单治理',
    description: '支持负责人分配、批量结案和 SLA 风险跟踪。',
  },
  {
    title: '照料者资质审核',
    description: '直接审核入驻资料、查看状态并跟进处理结果。',
  },
  {
    title: '回调审计与告警',
    description: '支付、退款回调和失败重放都可以直接排查。',
  },
] as const;

export const architectureLayers = [
  {
    title: '公开前台',
    summary: '用于展示 PetPal 产品、引导进入主人服务台和后台入口。',
    details: ['首页、结构页和登录方式页统一承载产品说明', '进入后台默认落到根级 `/petpal-admin` 入口'],
  },
  {
    title: '主人服务台',
    summary: '承载宠物档案、需求发布、订单跟进和售后透明度能力。',
    details: ['主人页只聚焦主人主流程，不再混入照料者入驻和履约动作', '服务详情页继续沉淀支付、退款、投诉和履约时间线'],
  },
  {
    title: '照料者工作台',
    summary: '承载照料者档案、服务设置和履约订单基础动作。',
    details: ['独立路由 `/petpal/caregiver` 用于承接照料者工作流', '高级兼容操作暂时保留在 `/petpal/legacy`'],
  },
  {
    title: '跨订单消息中心',
    summary: '承载主人与照料者跨订单消息聚合、未读处理与快捷跳转。',
    details: ['独立路由 `/petpal/messages` 用于集中查看订单会话', '继续复用订单详情页里的沟通发送与上下文信息'],
  },
  {
    title: 'PetPal 后台',
    summary: '承载投诉治理、照料者审核、回调审计与告警队列。',
    details: ['根级 `/petpal-admin/*` 路由不再依赖菜单树', '继续保留访问控制和工作区复用能力'],
  },
  {
    title: '认证与偏好同步',
    summary: '统一提供登录、注册和用户级偏好同步能力。',
    details: ['支持账号密码、邮箱验证码、手机验证码', '主人端退款导出模板已进入账户级偏好同步链路'],
  },
] as const;

export const operatingPrinciples = [
  '公开页只承载产品说明、主人端入口和后台直达入口，不再展示通用框架介绍。',
  '主人服务台聚焦宠物、需求、订单和售后，不混入照料者入驻、权限配置等后台实现细节。',
  '照料者工作台单独承接入驻、服务和履约动作，减少超级页面堆叠。',
  '后台入口聚焦投诉、审核和回调治理，路径直达，不要求先进入菜单树。',
  '关键履约、退款和投诉动作都要有留痕、可导出、可复核。',
] as const;

export const authStrategies = [
  {
    title: '用户名密码',
    code: 'username-password',
    identifier: '账号',
    credential: '密码',
    description: '适合后台管理员、运营和固定客服账号。',
  },
  {
    title: '邮箱验证码',
    code: 'email-code',
    identifier: '邮箱',
    credential: '验证码',
    description: '适合主人或后台人员通过邮箱完成身份确认。',
  },
  {
    title: '手机验证码',
    code: 'phone-code',
    identifier: '手机号',
    credential: '验证码',
    description: '适合移动端主人账号和短信触达场景。',
  },
] as const;

export const authJourney = [
  {
    title: '查看可用入口',
    body: '页面会根据当前配置展示当前可用的登录和注册方式。',
  },
  {
    title: '发送验证码',
    body: '需要验证码时，可直接发送并在当前页完成校验。',
  },
  {
    title: '完成身份校验',
    body: '账号或验证码校验通过后即可进入主人服务台或 PetPal 后台。',
  },
  {
    title: '同步账户偏好',
    body: '登录后会同步当前账号可见工作区和页面偏好，后续恢复更直接。',
  },
] as const;
