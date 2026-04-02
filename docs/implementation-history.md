# PetPal Development Summary

Last updated: 2026-04-03

本文档现在只保留“当前阶段总览”。原先按切片持续累积的详细开发日志，已经拆分到仓库根目录的 `archives/development-logs/` 下独立归档，避免继续堆在 `docs/` 目录中。

## 1. 当前总体结论

- 项目主线已经从通用 RBAC 模板明确转为 PetPal 真实业务系统，没有再停留在示例工程层面。
- 当前代码树已经形成“后端与 Web 主流程较完整、App 端可用性明显提升但仍需继续打磨”的结构。
- 按毕业设计交付标准评估，项目已经具备真实演示基础，但仍存在少量业务闭环和最终验收收口工作。

## 2. 当前实现状态

### 2.1 后端

- 已完成 RBAC、认证策略、上传链路、审计字段、软删除、定时任务等基础设施。
- 已完成 PetPal 主体模型与接口：宠物档案、需求发布、照料者档案、服务设置、订单、支付、退款、投诉、评价、服务日志。
- 已完成回调鉴权、回调审计、失败告警 outbox、死信重放、审计保留清理等治理能力。
- 已完成订单内消息会话主链路，支持主人与照料者在订单中发送文字和附件消息。
- 2026-04-03 已补照料者收益摘要接口、经营明细导出和导出筛选，后端现在可直接输出累计收入、近 30 天收入、售后风险、最近完成订单、服务收入结构、日 / 周 / 月趋势，以及只包含当前照料者已完成订单的经营 Excel 明细，并支持按时间范围和服务类型导出；Web 收益页现已继续补上快捷时间窗和最近一次导出条件持久化，Web / App 不再各自二次聚合订单。

### 2.2 Web 端

- 主人工作台已具备宠物建档、需求发布、订单跟踪、退款/投诉进度、交易与退款导出等能力。
- Web 前台已开始按角色拆路由：
  - `/petpal` 为新的主人服务台，并已接入交易导出、退款导出、筛选模板和确认完成动作。
  - `/petpal/caregiver` 为新的照料者工作台，并已接入资质材料上传、服务记录和签退动作。
  - `/petpal/caregiver/earnings` 为新的照料者收益页，并已切到后端收益摘要接口，统一展示累计收入、服务结构、售后风险和日 / 周 / 月趋势，同时已补经营明细导出入口、导出筛选条、快捷时间窗和最近一次筛选持久化。
  - `/petpal/reminders` 为新的提醒中心，并已接入高优先待办、近 48 小时安排和主人/照料者双视角分发。
  - `/petpal/messages` 为新的跨订单消息中心，并已接入未读筛选、按角色聚合和订单快捷跳转。
  - `/petpal/aftersales` 为新的主人售后中心，并已接入退款进度、投诉状态、优先级排序和退款明细导出入口。
  - `/petpal/legacy` 已收缩为兼容入口页，只保留旧链接兼容、概览汇总和任务分发。
  - 提醒中心、消息中心和售后中心已进一步补齐内联恢复态，支持未登录提示、角色未开通提示、区块重试、局部失败降级和可操作空态。
  - 主人服务台、照料者工作台和兼容入口也已补齐基础恢复态，支持未登录提示、整页错误恢复、局部失败 notice 和关键空态引导。
  - 主人服务台与照料者工作台已进一步补齐分区级恢复，关键业务区块支持局部错误降级和局部重试，不再只依赖整页刷新。
  - Web 前台恢复态工具已开始共享化，页面级 notice 拼接和分区重试逻辑不再散落复制在多个 PetPal 页面中。
  - 提醒中心现已补齐主人侧 / 照料者侧双分区恢复与角色聚焦，照料者入驻资料页也已支持 notice 回流、定向重试和保存后返回工作台。
  - 照料者工作台、服务清单、服务表单与 `legacy` 兼容页之间的高频入口现已补齐统一 handoff，旧入口回流时不再丢失上下文说明。
  - 主人工作台、宠物清单、宠物表单与需求表单之间的高频入口现也已补齐统一 handoff，建档 / 编辑宠物 / 发需求不再出现 owner 侧裸跳转。
  - 订单队列、订单详情、售后中心、需求建单和支付 / 退款 / 投诉 / 评价结果页之间的结果回流现也已补齐统一 handoff，交易结果链路不再出现页面无 notice 或回流丢焦点的问题。
  - 提醒中心和照料者服务管理链路的残余入口现也已补齐统一 handoff，提醒分流到新建服务 / 宠物建档、服务清单到编辑页、服务表单回列表都已有明确上下文说明。
  - 消息中心往返链路和订单详情缺失对象时的回流动作现也已补齐统一 handoff，提醒中心、主人 / 照料者总览和订单详情 fallback 不再出现裸跳或错角色回流。
  - 售后中心与支付 / 退款 / 投诉 / 评价结果页的残余 fallback 返回动作现也已补齐统一 handoff，辅助页在目标订单缺失时不再静默回默认队列。
  - 主人 / 照料者资源页与队列页页头的返回总览动作现也已补齐统一 handoff，工作台往返不再出现“进来有 notice、返回又裸跳”的断层。
  - 主人侧表单页页头返回和主人 / 照料者总览的残余 bare fallback 现也已补齐统一 handoff，宠物 / 需求表单回列表、售后中心 / 服务清单 fallback 不再静默跳转。
  - 主人 / 照料者工作台、提醒中心、消息中心、需求队列和售后中心的 page notice 逻辑已开始共享化，warning 标题、弱网提示和回流说明的拼接规则不再散落复制。
  - 宠物清单、主人订单、照料者资料、履约队列和服务清单这批资源页 / 队列页的 page notice 现也已迁到共享 helper，常用列表页的 notice 规则基本统一。
  - 宠物 / 需求 / 服务表单页、订单详情页和支付 / 退款 / 投诉 / 评价结果页的 page notice 也已改走共享 helper，PetPal Web 主要入口页的 notice 逻辑基本统一。
  - Legacy 兼容入口页也已改走共享 helper，PetPal Web 页面已不再散落手写的 page notice 组装逻辑。
- 订单详情页已具备支付/退款时间线、服务记录、评价、投诉、消息沟通等完整信息面板。
- 2026-04-01 新增前端重构蓝图文档，开始把 Web 首屏从“解释产品结构”改为“状态 + 动作 + 列表入口”。
- 主人工作台、照料者工作台、售后中心和订单详情页首屏已移除一批面向开发者/产品语义的讲解文案，开始收敛为真实可操作的工作台。
- 根级 `/petpal-admin/*` 后台已形成可直接进入的治理入口，不再依赖旧模板菜单路径。
- 后台已覆盖投诉治理、照料者审核、回调审计、告警队列等核心运营页面。

### 2.3 App 端

- 首页、服务台、资料页、我的页、设置页已基本切换为 PetPal 产品语义。
- `PetPal` 入口已改为角色入口页，主人侧拆出独立页面：主人首页、宠物档案、发布需求、订单跟进。
- 照料者侧已拆出独立页面：照料者首页、收益表现、入驻中心、服务管理、履约订单，并新增跨订单消息中心。
- App 照料者收益页已切到同一份后端收益摘要契约，Web / App 的收益口径与趋势维度开始统一。
- App 端主题变量、按钮、卡片、列表、导航和角色入口已开始统一为 Material Design 3 风格，资料页、设置页和提醒中心也已纳入同一体验基线。
- App 端已补帮助中心、账户支持中心、通知中心、起步向导和应用内主动催办信号，并把“我的 / 资料 / 设置 / 首页 / 消息 / 提醒 / 角色入口”等入口接入统一辅助流，账户帮助逻辑不再继续堆在旧入口里。
- 订单详情页已重构为概览 / 沟通 / 履约 / 售后分段视图，评价、投诉、退款进度、消息沟通等关键能力可按场景进入。
- 2026-04-01 已按新的 UX 蓝图开始重构 App P1 页面：
  - 角色入口页改为身份切换 + 直接操作，不再展示角色说明卡。
  - 主人首页改为“今天先做这个 + 当前优先 + 最近订单”的任务首页。
  - 发布需求页改为分步式需求向导，按“宠物 / 时间 / 要求 / 确认”顺序推进。
  - 订单列表改为状态筛选 + 下一步动作行，不再堆叠说明文案。
  - 售后中心改为优先级队列，不再先讲售后概念。
  - 订单详情页首屏已改为“状态 / 金额 / 下一步”导向，并在页面头部写入 UX 设计约束。
- 2026-04-02 已继续补主人交易主链路与账户 / 消息页收口：
  - 已新增 App 结算页，可把“已发布需求 -> 选照料者 -> 生成订单 -> 支付”串成连续动作。
  - 主人需求页已新增“继续已有需求”队列，支持恢复活跃需求并再次进入结算。
  - 结算页已允许只凭 `requestId` 恢复上下文，返回需求页时也会带回当前需求。
  - 主人订单页已把待支付订单主动作显式改为“去支付”。
  - 消息中心首屏已改为“未读数量 + 立即回消息 + 紧凑筛选”。
  - “我的”页已改为“账号概览 + 现在处理 + 账户工具”，移除说明式账户能力列表。
- 2026-04-02 已继续拆主人需求跟进流：
  - 新增 `pages/petpal/request-detail.vue`，把“活跃需求 -> 查看状态 -> 选照料者 -> 继续下单”从新建页中独立出来。
  - `pages/petpal/request.vue` 已收回为纯新建需求向导，不再堆放历史需求恢复、继续结算和匹配长期管理逻辑。
  - 主人首页、提醒中心、起步向导和结算页回退链路已开始统一落到 `request-detail`，活跃需求不再默认回到新建页。
- 2026-04-02 已继续增强主人需求详情页：
  - 已补匹配排序、候选快速切换和更紧凑的选中照料者摘要，不再只靠一排候选卡片。
  - 已补“改时间地点 / 改预算要求 / 重新确认”直达动作，需求变更可直接回到向导对应步骤。
  - `AppChoiceChips` 已补可选副标题能力，需求详情页开始转向更组件化的操作方式。
- 2026-04-02 已继续补主人需求详情页筛选与对比：
  - 已补预算内 / 更近 / 更稳等基础筛选，减少用户手动比价和来回切候选的成本。
  - 已补横向候选对比区，可直接比较预估金额、评分、距离和计价方式。
- 2026-04-02 已继续补主人端照料者可信信息快照：
  - 主人需求详情页已新增经验、提前预约时长、服务范围、专长和服务承诺展示，减少只按价格决策的风险。
  - 结算页已同步显示照料者介绍、可信标签、服务承诺和预约限制，支付前可直接完成确认。
- 2026-04-02 已继续收口主人端订单详情首屏：
  - 订单详情页总览首屏已新增阶段标签、快速动作 chips 和沟通 / 履约 / 售后信号卡。
  - 支付、沟通、履约、售后和评价入口已回到首屏，不再埋在长详情区块内部。
  - 订单详情页的沟通 / 履约 / 售后内容区已进一步改成工作区结构：沟通改为聊天流与发送区，履约改为最新节点与服务回传，售后改为摘要卡片与售后动态。
- 2026-04-02 已继续收口主人端反馈任务页：
  - 评价页已新增阶段标签、信号卡和更直接的评分/标签输入，不再只是一个长表单。
  - 投诉页已新增阶段标签、投诉进度信号卡、证据入口和问题补充 chips，提交与跟进路径更短。
- 2026-04-02 已继续重构主人端售后中心：
  - `pages/petpal/aftersales.vue` 首屏已改为“当前最急订单 + 退款 / 投诉 / 沟通信号 + 直接处理”结构。
  - 其他售后订单已改为可就地展开的摘要队列，先判断风险和结果，再决定是否进入订单详情。
  - 售后聚合页开始从统计页转为处理台，退款 / 投诉 / 沟通三类信息不再散在多张卡片里。
- 2026-04-02 已继续补主人端支付结果反馈：
  - 新增 `pages/petpal/payment-result.vue`，把“是否到账、订单当前阶段、下一步动作”从结算页中拆出。
  - `pages/petpal/checkout.vue` 已继续收回为“确认并支付”页，主按钮现在可直接串起“创建订单并支付”。
  - 支付成功后已直接进入结果页，不再要求用户自己回订单详情判断是否成功。
- 2026-04-02 已继续补主人端退款结果反馈：
  - 新增 `pages/petpal/refund-result.vue`，把“退款到了哪一步、已退多少、还剩多少可退、下一步怎么做”从订单详情长页中拆出。
  - 订单详情售后分栏与售后中心退款主动作都已接入退款结果页，退款链路不再强依赖用户自己翻售后时间线。
- 2026-04-02 已继续补主人端投诉结果反馈：
  - 新增 `pages/petpal/complaint-result.vue`，把“投诉处理到哪一步、平台最近做了什么、下一步怎么做”从投诉提交页和订单详情长页中拆出。
  - 售后中心投诉主动作、订单详情投诉入口和投诉提交成功回流都已接入投诉结果页，投诉链路不再强依赖用户自己翻处理日志。
- 2026-04-02 已继续补主人端评价结果反馈：
  - 新增 `pages/petpal/review-result.vue`，把“评分结果、订单下一步和是否还需继续沟通/售后”从评价填写页中拆出。
  - 订单详情、评价提交成功回流，以及支付/退款/投诉结果里的评价入口都已统一接到评价结果页或评价填写页，评价链路不再混用表单与结果。
- 2026-04-02 已继续收口 Web 端订单详情：
  - `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue` 已切成概览 / 沟通 / 履约 / 售后四段任务视图，首屏先展示当前阶段、主动作和信号卡，不再继续堆成长页。
  - Web 消息中心、售后中心和提醒中心进入订单详情时，已按场景自动带入沟通 / 履约 / 售后分栏，减少二次跳转后的重新找入口成本。
- 2026-04-02 已继续补 Web 端交易结果反馈：
  - 新增 `apps/web-frontend/src/pages/frontend/petpal/PetPalPaymentResultView.vue`、`PetPalRefundResultView.vue`、`PetPalComplaintResultView.vue`、`PetPalReviewResultView.vue` 以及共享 `PetPalOrderResultWorkbench.vue`，把支付 / 退款 / 投诉 / 评价统一承接到独立结果工作台。
  - `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue` 已新增支付 / 退款 / 投诉 / 评价结果入口，并支持通过 query action 直开评价 / 投诉动作。
  - Web 端评价与投诉提交成功后已直接回流对应结果页，不再只停留在订单详情弹窗成功提示。
- 2026-04-02 已继续收口 Web 前台跨页面回流与分区恢复态：
  - 新增 `apps/web-frontend/src/pages/frontend/petpal/rebuild/petpal-desk-notice.vue`，并为 `petpal-desk-page.vue` 增加 notice 槽位，统一承接“从上一页带着上下文回来”和“当前分区未刷新完成”的提示。
  - `apps/web-frontend/src/pages/frontend/petpal/recovery.ts` 已补齐 handoff query 构建与解析工具，支持 `focusOrderId / focusRole / focusFilter / tab / notice` 一组轻量路由上下文。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerOrdersView.vue`、`PetPalMessagesView.vue`、`PetPalAftersalesView.vue`、`PetPalCaregiverOrdersView.vue` 现已支持按 query 恢复焦点订单、切回正确视角或筛选，并在加载失败时只重试当前工作台分区。
  - `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue` 已支持按 `tab=messages|service|aftersales` 直接滚动到对应分区，同时把沟通区和售后区失败重试拆成局部动作。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOrderResultWorkbench.vue` 与 `PetPalRemindersView.vue` 已接通新的回流 query，不再把用户统一丢回无上下文的订单队列。
- 2026-04-03 已继续收口 Web 资源页与总览页回流：
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetsView.vue`、`PetPalOwnerRequestsView.vue`、`PetPalCaregiverServicesView.vue` 已支持按 query 恢复焦点宠物 / 需求 / 服务，并在列表或匹配区失败时提供定向重试。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetFormView.vue`、`PetPalOwnerRequestFormView.vue`、`PetPalCaregiverServiceFormView.vue` 保存成功后已带 notice 和焦点项回到对应列表，不再落回无上下文状态。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue` 与 `PetPalCaregiverView.vue` 已拆成分区级恢复态，宠物 / 需求 / 订单和资料 / 服务 / 履约现在都可独立重试。
  - 主人 / 照料者总览里的“当前下一步”和卡片内入口也开始带上下文跳转，不再只是泛化的页面级跳转。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue` 与 `PetPalOwnerPetsView.vue` 已继续补齐主人侧残余入口 handoff，建档、编辑宠物和发需求的高频入口现在都走统一 query helper。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerRequestFormView.vue` 与 `PetPalOwnerPetFormView.vue` 已开始承接 handoff notice，并为缺失宠物对象的编辑回流补齐带说明的返回路径。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerOrdersView.vue`、`OrderDetailView.vue`、`PetPalAftersalesView.vue` 已继续补齐支付 / 退款 / 投诉 / 评价结果页入口和回详情 / 回队列动作的 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOrderResultWorkbench.vue` 已开始承接 handoff notice，`PetPalOwnerRequestsView.vue` 建单后也会带着 notice 进入支付结果页。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalRemindersView.vue`、`PetPalCaregiverView.vue`、`PetPalCaregiverServicesView.vue` 已继续补齐照料者服务管理和提醒中心的残余创建 / 编辑 / 履约入口 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalCaregiverServiceFormView.vue` 已开始承接 handoff notice，并为缺失服务对象的编辑回流补齐带说明的返回路径。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalMessagesView.vue`、`PetPalRemindersView.vue`、`PetPalOwnerView.vue`、`PetPalCaregiverView.vue`、`OrderDetailView.vue` 已继续补齐消息中心往返链路和详情页 fallback 回流的 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalAftersalesView.vue`、`PetPalOrderResultWorkbench.vue` 已继续补齐售后中心和结果页残余 fallback 动作的 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetsView.vue`、`PetPalOwnerRequestsView.vue`、`PetPalOwnerOrdersView.vue`、`PetPalCaregiverServicesView.vue`、`PetPalCaregiverOrdersView.vue`、`PetPalCaregiverProfileView.vue` 已继续补齐资源页 / 队列页页头返回工作台动作的 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetFormView.vue`、`PetPalOwnerRequestFormView.vue`、`PetPalOwnerView.vue`、`PetPalCaregiverView.vue` 已继续补齐主人侧表单返回动作和总览页残余 fallback 的 handoff。
  - `apps/web-frontend/src/pages/frontend/petpal/recovery.ts`、`PetPalOwnerView.vue`、`PetPalCaregiverView.vue`、`PetPalRemindersView.vue`、`PetPalMessagesView.vue`、`PetPalOwnerRequestsView.vue`、`PetPalAftersalesView.vue` 已开始共享 page notice 计算，统一 warning / success 标题与说明拼接逻辑。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetsView.vue`、`PetPalOwnerOrdersView.vue`、`PetPalCaregiverProfileView.vue`、`PetPalCaregiverOrdersView.vue`、`PetPalCaregiverServicesView.vue` 已继续改走共享 page notice helper。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerPetFormView.vue`、`PetPalOwnerRequestFormView.vue`、`PetPalCaregiverServiceFormView.vue`、`OrderDetailView.vue`、`PetPalOrderResultWorkbench.vue` 已继续改走共享 page notice helper。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalLegacyWorkbenchView.vue` 已补齐最后一个 legacy 兼容入口页的共享 page notice 计算。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalCaregiverEarningsView.vue` 已新增独立收益工作台，开始承接累计收入、近 30 天收入、平均客单价、服务收入结构和售后风险聚合。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalCaregiverView.vue` 已把活跃履约订单和已完成订单拆开统计，当前只剩已完成订单时会直接进入收益页，而不再误导回履约队列。
- 2026-04-03 已继续收口照料者收益摘要与双端消费：
  - `apps/backend/src/routes/petpal.ts`、`apps/backend/src/services/petpal-service.ts`、`packages/api-common/src/types/petpal.ts`、`packages/api-common/src/api/factory.ts` 已新增照料者收益摘要契约与 `/api/petpal/caregiver/earnings-summary` 接口。
  - `apps/backend/test/integration/petpal-api.test.ts` 已补未审核空摘要与已审核聚合结果的定向集成测试。
  - `apps/web-frontend/src/pages/frontend/petpal/PetPalCaregiverEarningsView.vue`、`apps/app-frontend/src/pages/petpal/caregiver-earnings.vue` 已改为消费后端收益摘要，不再各自拉订单列表后在前端重复聚合。
- 2026-04-03 已继续补照料者收益趋势：
  - 照料者收益摘要已扩展 `daily / weekly / monthly` 趋势桶，覆盖最近 7 天、8 周和 6 个月的完成单收入与单量。
  - Web / App 收益页都已开始展示日 / 周 / 月趋势，不再只停留在累计收入和服务结构摘要。
- 2026-04-02 已继续重构 App 宠物档案页：
  - `apps/app-frontend/src/pages/petpal/pets.vue` 已从“概览 + 整页长表单 + 列表”改成“宠物切换 + 当前档案预览 + 分区编辑 + 底部动作”结构。
  - 当前宠物可直接切换、直接发需求，编辑区已拆成基础 / 照料 / 健康 / 紧急四个分区，不再默认整屏铺开所有字段。
  - 页面头部已补齐 UX Blueprint，页面内已去掉原先偏说明式的长描述，改为状态和动作优先。
- 2026-04-02 已继续重构 App 主人首页与需求页：
  - `apps/app-frontend/src/pages/petpal/owner-home.vue` 已改成“任务首页 + tabbar 主导航”结构，首页不再内置现在 / 宠物 / 需求 / 订单场景切换。
  - App 主人端主导航已固定为 `首页 / 订单 / 消息 / 我的`，`owner-home` 已升为真实启动首页。
  - `apps/app-frontend/src/pages/petpal/request.vue` 已改成“轻编辑器”结构，补入宠物卡片、服务块、时段预设、预算快捷项、要求标签和历史需求复用轨道。
  - 两页首屏都已进一步压掉说明性文案，改为状态、动作和就地切换优先。
- 2026-04-02 已继续收口 App 角色中枢与消息中心：
  - `apps/app-frontend/src/pages/petpal/index.vue` 已改成“双身份卡片 + 当前身份启动板 + 高频任务宫格”，不再用分段列表做角色页。
  - `apps/app-frontend/src/pages/petpal/messages.vue` 已改成“最急会话 + 角色横向轨道 + 紧凑会话队列”，把消息页重新压回“回消息”主任务。
- 2026-04-02 已继续重构 App “我的”页：
  - `apps/app-frontend/src/pages/me/me.vue` 已改成“账户头部 + 横向快捷动作 + 当前优先任务 + 紧凑服务组 + 最近订单”结构。
  - 页面不再使用“账号概览 / 现在处理 / 账户工具”式分段结构，首屏改为账户状态和最近任务优先。
- 2026-04-02 已继续重构 App 资料页：
  - `apps/app-frontend/src/pages/me/profile.vue` 已改成“头像与状态头部 + 快捷支持入口 + 基本资料表单 + 紧凑账号信息”结构。
  - 页面不再展示工作区、后台权限和账号能力说明，主任务重新回到资料编辑和保存。
- 2026-04-02 已继续重构 App 通知页与帮助页：
  - `apps/app-frontend/src/pages/notifications/index.vue` 已改成“最急通知 + 范围轨道 + 紧凑收件箱”结构。
  - `apps/app-frontend/src/pages/help/index.vue` 已改成“问题类型入口 + 常用支持入口”结构，去掉 FAQ 长文和说明块。
- 2026-04-02 已继续重构 App 支付结果页与退款结果页：
  - `apps/app-frontend/src/pages/petpal/payment-result.vue` 已改成“支付结论 + 下一步动作 + 紧凑支付记录”结构。
  - `apps/app-frontend/src/pages/petpal/refund-result.vue` 已改成“退款阶段 + 售后下一步 + 紧凑退款记录”结构。
- 2026-04-02 已继续重构 App 投诉结果页与评价结果页：
  - `apps/app-frontend/src/pages/petpal/complaint-result.vue` 已改成“投诉结论 + 下一步动作 + 紧凑处理日志”结构。
  - `apps/app-frontend/src/pages/petpal/review-result.vue` 已改成“评分结果 + 下一步动作 + 紧凑评价卡片”结构。
- 2026-04-02 已继续重构订单详情页顶部决策区：
  - `apps/app-frontend/src/pages/order-detail/index.vue` 已把顶部改成“分栏轨道 + 当前先做这个 + 高频动作卡”结构。
  - 订单详情页首屏已从“先读信息”进一步压向“先做事”，减少 chips 式说明入口。
- 2026-04-02 已继续重构 App 订单列表页：
  - `apps/app-frontend/src/pages/petpal/orders.vue` 已改成“当前最急订单 + 可展开订单队列”结构，统计区不再和同质化列表卡重复占首屏。
  - 用户现在可以在订单页就地展开单笔订单，直接进入沟通、履约、支付或售后动作。
- 2026-04-01 已继续完成 App P2 照料者侧重构：
  - 照料者首页改为“今天先做这个 + 当前优先 + 今日订单 + 服务与收益”结构。
  - 履约订单页改为状态筛选 + 任务队列 + 就地服务记录面板，接单、签到、记录服务和签退都可直接执行。
  - 服务管理页改为就地编辑与快速上下架页面，不再依赖说明卡和二次跳转。
  - 所有本轮重构页面都已在 Vue 文件头部补齐 UX Blueprint 注释，明确入口场景、首屏目标和主次动作。
- 2026-04-01 已继续收口 App 订单动作链路：
  - 新增独立的订单评价页与投诉页，把评价和投诉从订单详情中拆出。
  - 订单详情页已移除内嵌评价/投诉长表单，回到“状态 + 金额 + 下一步动作”壳层。
  - 评价与投诉动作现在通过独立页面完成，避免单页继续堆叠过长交互。
- 2026-04-02 已继续清理旧入口：
  - `pages/petpal/workbench.vue` 已改为兼容跳转页，不再渲染旧综合工作台。
  - 历史 workbench 书签或旧入口会按旧参数自动跳到新的主人页、照料者页、消息页或提醒页。
- 旧的综合工作台已不再对用户开放，只保留 workbench 路由级兼容跳转，新的主人/照料者入口已默认进入拆分后的页面体系。
- 相比 Web 端，App 端在系统级主动提醒、跨角色动态引导、进一步打磨交互完整性和更多治理辅助能力上仍有缺口，但应用内主动催办已经开始前置到关键页面。

### 2.4 当前主要短板

- App 端主人与照料者核心主流程已经拆开，照料者首页、履约订单、服务管理以及订单评价/投诉动作也已切到拆页结构；支付/退款/投诉/评价结果页已统一拆出，但系统级主动提醒和更深的动态引导仍未收口。
- App 端订单详情已经基本完成“首屏决策 + 分栏任务区”重构，但订单列表、结果页与售后中心之间的跨页面主动回流仍可继续增强。
- App 端订单列表已经开始从“筛选 + 卡片列表”转向“任务队列”，但与结果页、售后中心、消息中心之间的主动回流仍可继续增强。
- Web 端结果页、队列页、资源页和主人 / 照料者总览之间已经建立焦点回流与分区级重试，但表单页保存后的更多细粒度回流、系统级主动提醒和少量辅助页的说明式布局仍待统一。
- 健康记录独立子表、更完整的收益分析、规则发布、违规处罚、运营看板等能力仍未形成完整前后端闭环。
- 最终答辩所需的统一验收脚本、截图素材、图表与论文配套文档仍需集中整理。

## 3. 关键演进脉络

- 第一阶段完成 monorepo、RBAC、认证、上传、菜单与控制台体系，为业务迁移提供工程底座。
- 第二阶段完成 PetPal P0 前台、订单详情与支付退款时间线，并搭建支付回调鉴权与审计基线。
- 第三阶段围绕回调治理持续增强，补齐审计、告警 outbox、重放日志、保留策略与后台运维页面。
- 第四阶段开始全面转向真实业务闭环，补齐照料者入驻、履约、服务日志、评价、投诉、退款与售后时间线。
- 第五阶段继续把项目从模板语义收口为 PetPal 产品，实现根级后台、公开页产品化和 App 端主入口重构。
- 第六阶段完成后台根级迁移、App 双工作台、健康档案与资质材料补齐，以及订单消息闭环。
- 第七阶段开始执行 P1 UX 重构，把 App 主人侧从综合工作台拆为独立任务流页面，并把订单详情改为分段场景视图。
- 第八阶段进入 P2 UX 收口，把照料者核心工作流、跨订单消息中心、主人售后中心和提醒中心从兼容工作台中拆出，形成新的 app 页面骨架。
- 第九阶段开始统一 App 设计系统，把主题 token、通用组件和关键入口页切到 Material Design 3 视觉与交互基线。
- 第十阶段开始补账户辅助体系，把帮助中心和账户支持中心从“我的 / 设置”内部说明抽离成独立页面。
- 第十一阶段把通知中心落地到 App，形成统一收件箱、已读追踪与跨页面通知入口。
- 第十二阶段把起步向导落地到 App，形成按主人 / 照料者路径拆分的分步引导和角色切换辅助页。
- 第十三阶段把应用内主动催办信号前置到首页、角色入口和主流程首页，减少用户先进入中心页再自行判断优先级的成本。
- 第十四阶段开始推进 Web 前台真实路由拆分，把主人主流程、照料者主流程和跨订单消息聚合从旧混合工作台中切出，并保留 `legacy` 作为兼容过渡层。
- 第十五阶段开始收口主人端交易闭环细节，让活跃需求恢复、结算回流、待支付动作和账户/消息高频页真正可用。

## 4. 下一步建议

- 第一优先级继续是 App / Web 用户操作逻辑页面重构；Web 主流程已基本脱离 `legacy`，核心场景页与工作台页都已补齐分区级恢复态，下一步重点转向更细的弱网反馈、动作后结果引导和更主动的跨页面引导。
- 新的编码前置规则已经冻结：任何页面重写前，必须先在 `apps/docs/project/PetPal-Frontend-Blueprint.md` 中明确用户流、场景与页面职责，再开始编码。
- App 端体验基线采用 Material Design 3，统一层级、动效、状态反馈和响应式规则。
- App 主人端已拆出独立需求详情页，并补入基础排序、筛选、对比和步骤化调整入口，但后续仍应继续补更细的照料者详情、更多筛选维度和原地改期能力，避免逻辑重新堆回新建页。
- App 主人端需求详情和结算页已经补入首批照料者可信信息快照，主人首页与需求页也已开始转成更接近原生 App 的轻交互结构，但订单详情、售后页和评价页仍需继续按同样的动作优先标准重构。
- App 主人端订单详情首屏、支付结果页、退款结果页、投诉结果页、评价结果页、售后中心、评价页和投诉页已经开始统一到动作优先结构。
- Web 端订单详情、结果页、队列页、资源页以及主人 / 照料者总览已经开始统一到“焦点对象 + 下一步动作 + 局部恢复”的结构，但系统级主动提醒、少量辅助页和更深的保存后回流仍需继续收口。
- Web 前台已进入主人 / 照料者路由拆分阶段，后续要继续把剩余高级兼容动作按角色迁出。
- 以“真实验收”为目标，继续收口更完整的收益分析、规则治理、运营看板与补充测试。
- 把最终交付材料从开发文档中拆出，单独整理验收脚本、演示路径、截图和答辩素材。

## 5. 开发日志归档索引

- [Archive Index](../archives/development-logs/README.md)
- [01. Foundation And RBAC (Sections 1-13)](../archives/development-logs/01-foundation-and-rbac.md)
- [02. PetPal P0 And Callback Baseline (Sections 14-25)](../archives/development-logs/02-petpal-p0-and-callback-baseline.md)
- [03. Callback Governance Expansion (Sections 26-48)](../archives/development-logs/03-petpal-callback-governance.md)
- [04. Business Loop Buildout (Sections 49-72)](../archives/development-logs/04-petpal-business-loop.md)
- [05. Export Enhancements And Productization (Sections 73-87)](../archives/development-logs/05-petpal-export-and-productization.md)
- [06. Root Admin, App Rebuild And Messaging (Sections 88-104)](../archives/development-logs/06-petpal-admin-app-and-messaging.md)

## 6. 使用方式

- 想快速知道项目现在做到哪一步，先读本文档。
- 想追具体阶段、切片背景和实现演化，再进入归档目录按主题查看。
- 后续如果再出现超长实现日志，继续按“总览留在 `docs/`，详细历史归档到 `archives/development-logs/`”的方式维护。
