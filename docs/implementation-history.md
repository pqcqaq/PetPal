# Implementation History

Last updated: 2026-04-01

本文档记录最近一轮主要实现成果，用于帮助后续开发者快速恢复项目上下文。它不是计划，也不是宣传文案，而是“已经落地了什么”的摘要。

## 1. Monorepo 基线建立

- 仓库按 `pnpm workspace` 收敛为统一 monorepo。
- 明确分为四个主要边界：
  - `apps/backend`
  - `apps/web-frontend`
  - `apps/app-frontend`
  - `packages/api-common`
- 共享请求适配器、类型和 Header 常量下沉到 `api-common`，避免 Web 与 Uni 两端重复维护接口契约。

## 2. 后端 RBAC 基础能力落地

- 完成用户、角色、权限及关联表建模。
- 实现用户、角色、权限的完整 CRUD。
- 支持权限来源分析，用于解释某个用户为何拥有某个权限。
- 补齐 dashboard 汇总、实时频道和审计日志能力。

## 3. 认证体系从单一登录升级为“Client + Strategy”

- 新增 `AuthClient` 模型，系统级客户端需要通过 code + secret 才能调用认证接口。
- 新增 `AuthStrategy`、`UserAuthentication`、`VerificationCode` 三张核心表。
- 认证逻辑改为策略模式，当前内置：
  - 用户名密码
  - 邮箱验证码
  - 手机验证码
- 登录、注册、验证码发送、验证码校验不再写死在单一路径里，而是根据策略配置走不同处理器。
- strategy 支持 mock 开关和 mock value，便于本地联调。
- 刷新令牌与 token 链路保留 client 来源语义，避免多客户端之间相互串用。

## 4. ORM 层统一审计字段、软删除与雪花 ID

- 核心实体统一包含：
  - `id`
  - `createId`
  - `updateId`
  - `createdAt`
  - `updatedAt`
  - `deleteAt`
- 雪花算法成为统一主键生成方式。
- Prisma 扩展层统一注入 create/update/delete 语义：
  - 创建时自动补齐 `id/createId/updateId`
  - 更新时自动补齐 `updateId`
  - 删除时映射为 `deleteAt`
  - 查询默认过滤逻辑删除记录

## 5. 上传链路生产化

- Web 端头像上传改为直传 S3 兼容对象存储。
- 支持本地降级、单片上传和分片上传。
- 上传回调负责落库完成状态与 URL。
- 未完成单片直传会进入后台补偿流程。

## 6. 定时任务从独立 worker 合并到 backend timers

- 原先独立的后台 jobs 目录被移除。
- 统一在 `apps/backend/src/timers` 内建立 timer 注册中心。
- 基于 `toad-scheduler` 封装可复用 interval timer。
- 上传巡检已迁入 backend 主进程，在启动与关闭阶段统一纳管。

## 7. 菜单树与控制台路由体系重构

- 后端菜单表成为导航事实来源。
- 菜单节点明确区分：
  - directory
  - page
  - action
- 页面路由从“静态前端主导”收敛为“后端菜单 + 前端页面注册”协作模式。
- 控制台页面统一迁到 `/console/**`。
- 公共介绍页独立为 `/` 命名空间，对外展示项目能力而不是直接暴露后台壳子。

## 8. Web 前端工作台与页面规范收敛

- 建立统一的 ConsoleLayout / FrontendLayout 分层。
- 后台页面陆续按统一目录规范重构：
  - 搜索表单
  - 列表
  - 详情
  - 编辑
  - 页面局部组件
- 页面目录内新增 `components` 子目录，用于拆出细节组件。
- `PageScaffold`、工作台标签、菜单注入和页面元信息继续作为控制台体验基石。

## 9. 菜单管理与右键菜单完善

- 菜单结构管理页从原先难维护的交互模式重构为更明确的树面板 + 检查面板 + 弹窗编辑模式。
- 解决了树节点区域留白过大、展开/收起不顺手等问题。
- 为菜单页补齐右键菜单能力，统一结构性操作入口。
- 共享右键菜单抽象也应用于控制台其他区域。

## 10. 前端权限裁剪能力落地

- 新增 `v-permission` 与 `v-role` 指令。
- 支持 `and` / `or` 运算语义。
- 指令基于登录后拿到的角色列表和权限列表决定元素是否展示。
- 这是一层展示优化，不替代后端真实鉴权。

## 11. 公共前台与登录页视觉升级

- 公共前台新增项目首页、系统架构页、认证策略页。
- Header / Footer 统一由布局管理。
- 登录页重构为更正式的展示型布局，兼顾策略切换、验证码发送和项目价值表达。

## 12. 当前结果

到目前为止，这个仓库已经不是一个“登录 + 用户表 + 菜单页”的基础示例，而是一套具备以下特征的工程底座：

- 真正数据库驱动的 RBAC
- 多客户端、多策略认证
- 前台与控制台双命名空间
- 审计字段、软删除、雪花 ID 的数据层基线
- S3 兼容上传与补偿 timer
- 统一页面规范、右键菜单和展示层权限指令
- 可继续向更复杂业务系统演进的 Monorepo 结构

## 13. OAuth 授权页迁移到 Web 前端

- OAuth2 授权确认页与授权错误页从 backend 的 HTML 模板渲染迁移到 `apps/web-frontend`。
- `/oauth2/authorize` 在需要用户确认授权时，不再由 backend 输出页面，而是重定向到 web 前端路由：
  - `/oauth/authorize`
  - `/oauth/error`
- backend 新增授权会话 API，用于前端渲染和提交授权决策：
  - `GET /api/oauth/authorize-sessions/:sessionState`
  - `POST /api/oauth/authorize-sessions/:sessionState/decision`
- `packages/api-common` 新增授权会话与决策类型，并在 API factory 中补充对应客户端调用。
- web 前端新增 OAuth 授权确认页与错误页，实现会话加载、同意/拒绝提交和错误兜底跳转。
- backend 旧的 OAuth 页面模板与 EJS 依赖已移除，授权流程职责收敛为“协议处理 + API 提供”。

## 14. PetPal P0 前端首批落地

- `packages/api-common` 新增 PetPal 共享契约与 API 工厂端点，统一 Web 与 Uni 的请求边界。
- Web 前台新增 `'/petpal'` 业务页，提供宠物档案、需求发布、订单总览、照料者匹配的最小闭环。
- Uni 端新增 `pages/petpal/index`，并在首页快捷入口挂载“宠托帮”。
- 本轮验证通过：
  - `pnpm --filter @rbac/api-common build`
  - `pnpm --filter @rbac/web-frontend lint`
  - `pnpm --filter @rbac/app-frontend type-check`

## 15. PetPal 订单详情页与支付/退款时间线展示 (P0 Slice 5)

- **后端 API**：已完成 `GET /api/petpal/orders/:id` 返回完整订单记录，包含 payments 和 refunds 数组。
- **共享契约扩展**：
  - `packages/api-common` 新增 `PaymentRecordDetail` 与 `RefundRecordDetail` 接口，扩展了时间戳、操作者和原因字段。
  - `OrderDetailRecord` extends `OrderRecord`，确保兼容现有订单结构。
- **Web 前台订单详情页**：
  - 新建 `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`（476 行）。
  - 布局为：订单基础信息卡 → 金额统计卡 → 支付时间线 → 退款时间线。
  - 支付/退款记录以时间线形式展示，包含：编号、状态标签、金额、类型、完成时间。
  - 状态类型映射 (TypeScript literal union) 用于 Element Plus 表签元素。
  - `amountAdjusted` 通过 `Number()` 强制转换后参与大小比较，确保类型安全。
  - 路由集成：`/petpal/order-detail/:id` 作为新路由入口。
  - PetPalOwnerView.vue 订单表新增"操作"列，点击"查看详情"按钮导航。
- **Uni 端订单详情页**：
  - 新建 `apps/app-frontend/src/pages/order-detail/index.vue`（444 行）。
  - 同步 Web 的页面结构与时间线展示逻辑。
  - 使用 `onLoad` 生命周期钩子捕获页面参数（`?id=xxx`）。
  - 自定义组件（AppPageShell / AppSection）替代 Element Plus 组件。
  - 实施 `uni.navigateBack()` 导航 API 调用。
  - pages.json 新增 `petpal` 和 `order-detail` 分页配置。
  - pages/petpal/index.vue 订单列表新增导航跳转 (`goToOrderDetail` 方法)。
  - 新增 `getOrderDetail` API 包装函数。
- **验证与类型安全**：
  - 全文关键问题：`AmountValue` 类型为 `number | string` 联合体，算术操作前必须 `Number()` 强制转换。
  - `uni` 全局对象只能在脚本任务里直接调用，模板里需要通过方法代入而非行内表达式。
  - 重构后验证通过：
    - `pnpm --filter @rbac/api-common build` ✓
    - `pnpm --filter @rbac/web-frontend lint` ✓
    - `pnpm --filter @rbac/app-frontend type-check` ✓
- **Git 提交**：`feat(p0): deliver petpal order-detail bilateral pages (slice 5)` 
  - 8 files changed, 972 insertions(+), 创建 OrderDetailView.vue 与 order-detail/index.vue 两个详情页。

## 16. PetPal 回调鉴权适配层（P0 Slice 6）

- backend 新增 `petpal-callback-auth` 服务，将 PetPal 回调鉴权从路由层抽离为独立适配层。
- 鉴权模式支持：
  - `TOKEN`：兼容既有 `x-petpal-callback-token`。
  - `WECHATPAY`：基于签名、时间戳、nonce 的回调校验流程（接入路径）。
- `apps/backend/src/routes/petpal.ts` 的支付/退款回调均改为统一调用 `verifyPetpalCallbackAuth`。
- 环境配置新增：
  - `PETPAL_CALLBACK_AUTH_MODE`
  - `PETPAL_WECHATPAY_NOTIFY_SECRET`
  - `PETPAL_WECHATPAY_TIMESTAMP_TOLERANCE_SECONDS`
- `apps/backend/.env.example` 已补齐变量模板，避免硬编码。
- 新增测试 `apps/backend/test/services/petpal-callback-auth.test.ts`，覆盖 TOKEN 与 WECHATPAY 成功路径。
- 本轮验证通过：
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend exec node --import tsx --test test/services/petpal-callback-auth.test.ts`

## 17. PetPal 回调状态机边界测试加固（P0 Slice 7）

- `apps/backend/test/integration/petpal-api.test.ts` 增加支付/退款回调边界用例：
  - 支付失败后成功恢复。
  - 退款失败后成功恢复。
  - 幂等回调与恢复回调混合场景下金额守恒断言。
- 测试数据枚举与 Prisma 模型保持一致（`BALANCE`、`PARTIAL`），避免无效枚举导致误报。
- 本轮验证通过：
  - `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts`

## 18. PetPal WeChat Pay 验签路径与原始请求体基线（P0 Slice 8）

- `petpal-callback-auth` 新增 WeChat Pay 验签 provider 切换：`HMAC` / `SDK`。
- 新增 `petpal-wechatpay-sdk-adapter` 作为 SDK 集成路径，保持业务侧调用入口不变。
- Express JSON 解析增加 raw body 保存，回调验签改为优先使用原始请求体。
- 环境模板补齐 SDK 路径配置项（商户号、应用号、证书序列号、平台公钥）。
- 回调鉴权单测新增失败路径：
  - 无效签名拒绝。
  - 时间戳超时拒绝。
- 本轮验证通过：
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend exec node --import tsx --test test/services/petpal-callback-auth.test.ts`
  - `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts`

## 19. PetPal 回调审计明细响应化（P0 Slice 9）

- `verifyPetpalCallbackAuth` 增加返回值，输出回调鉴权元数据：
  - `sourceMode`
  - `signatureDigest`
  - `callbackTimestamp`
- `apps/backend/src/routes/petpal.ts` 在支付/退款回调成功响应中新增 `callbackAuth`，并附带 `requestId`。
- `petpal-api` 集成测试新增回调审计字段断言，确保鉴权与可追踪信息随主流程稳定输出。
- 本轮验证通过：
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend exec node --import tsx --test test/services/petpal-callback-auth.test.ts`
  - `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts`

## 20. PetPal 回调审计持久化（P0 Slice 10）

**内容**：从 API 响应级审计元数据到数据库模型持久化，支持事务内记录每一次回调处理。

核心实现：

- 新增 `CallbackAudit` 数据模型（`apps/backend/prisma/models/petpal.prisma`）：
  - 字段：`callbackType`（PAYMENT_CALLBACK|REFUND_CALLBACK）、`paymentId`/`refundId` 外键、`requestId` 唯一、`sourceMode`、`signatureDigest`、`callbackTimestamp`、`callbackStatus`（PENDING|SUCCESS|FAILURE|ERROR）、`verificationResult`（JSON）、`rawPayload`。
  - 索引：`(requestId)` unique、`(callbackType, callbackStatus)` 复合、`(paymentId)`、`(refundId)`、`(createdAt)`、`(sourceMode)`。
- 数据库迁移文件 `20260330170919_add_callback_audit_table`：
  - 创建 `CallbackAudit` 表、定义外键约束。
  - `PaymentRecord` / `RefundRecord` 反向关系添加 `callbackAudits` 字段。
- 服务层调整（`apps/backend/src/services/petpal-service.ts`）：
  - `handlePaymentCallback()` / `handleRefundCallback()` 方法扩展参数，新增可选 `auditInfo` 对象，包含 `requestId`、`sourceMode`、`signatureDigest`、`callbackTimestamp`、`rawPayload`。
  - 在事务内创建 `CallbackAudit` 记录：成功/失败/重试（idempotent）均记录，`callbackStatus` 自动判定。
- 路由层调整（`apps/backend/src/routes/petpal.ts`）：
  - `/api/petpal/payments/callback` 与 `/api/petpal/refunds/callback` 从 `authMeta` 和 `requestId` 构建 `auditInfo`，传入服务方法。
  - 保持响应格式不变，仍输出 `callbackAuth`。
- 集成测试扩展（`apps/backend/test/integration/petpal-api.test.ts`）：
  - 新增断言：支付回调创建 `CallbackAudit`、失败回调创建失败审计、重试回调也记录。
  - 验证 `callbackType`、`callbackStatus`、`sourceMode`、`signatureDigest` 等字段正确性。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（4/4 tests，新增审计测试）。
- Git commit：`feat(p0): implement callback audit persistence with DB model, service layer, and tests (slice 10)`。

关键设计决策：

- 审计责任从 API 响应级转移至数据库持久化级，支持后续查询、统计、告警。
- `rawPayload` 保留原始回调 body，便于问题诊断。
- `verificationResult` 以 JSON 存储验证结果详情，包括成功/失败/idempotent 标志。
- `requestId` 唯一索引确保审计链可追溯。

风险与后续：

- 审计表增长快速，后续考虑引入分区、归档、或采样策略。
- 下一步（Slice 11）：管理端查询 API 支持分页、过滤（按日期、sourceMode、callbackStatus）。

## 21. PetPal 管理端回调审计查询 API（P0 Slice 11 Part 1）

**内容**：后端查询接口支持审计日志的多维过滤、分页展示。

核心实现：

- 新增服务方法 `queryCallbackAuditLogs(filters)` - `apps/backend/src/services/petpal-service.ts`：
  - 参数支持分页（page、pageSize）。
  - 参数支持多维过滤（callbackType、callbackStatus、sourceMode、requestId、paymentId、refundId、startDate、endDate）。
  - 查询包含 `payment` / `refund` 关联对象摘要。
  - 排序：`createdAt desc`，支持后续扩展（sourceMode、callbackStatus）。
- 新增管理端 API 路由 `/api/petpal/admin/callback-audits` - `apps/backend/src/routes/petpal.ts`：
  - GET 方法，支持查询参数直接映射。
  - 示例：`GET /api/petpal/admin/callback-audits?page=1&pageSize=20&callbackStatus=SUCCESS&sourceMode=TOKEN`。
  - 返回 `{ items: [...], pagination: {...} }`。
- 集成测试覆盖（5/5 tests pass）：
  - 全查询、类型过滤、状态过滤、来源过滤、requestId 精确查询、分页。
  - 断言返回结构正确、过滤条件生效、分页参数准确。

验证与设计决策：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（5/5）。
- Git commit：`feat(p0): add admin API for querying callback audit logs with filters (slice 11 part 1)`。
- 关键设计：查询接口与管理端 UI 分离，API 层负责数据聚合，UI 层负责展示与交互。

已识别的优化空间：

- 后续可添加全文搜索（rawPayload 模糊匹配）。
- 可添加导出（CSV/JSON）功能。
- 可添加实时统计（按 sourceMode、callbackStatus 的聚合计数）。

## 22. PetPal SDK 失败路径测试（P0 Slice 12）

**内容**：后端 SDK 验证路径失败处理单元测试，确保当第三方 SDK 不可用时系统优雅降级。

核心实现：

- 新增单元测试用例（2 个） - `apps/backend/test/services/petpal-callback-auth.test.ts`：
  1. `returns error when SDK provider is configured but SDK is unavailable`
     - 场景：配置 WeChat Pay SDK 提供商，但 SDK 依赖不可用或密钥无效。
     - 预期行为：抛出明确错误（OpenSSL 解码错误或依赖缺失）。
     - 验证方式：`assert.throws()` 捕获错误，验证消息包含关键词。
  2. `returns correct metadata with SDK mode in successful callback`
     - 场景：SDK 模式验证成功。
     - 预期行为：返回包含 `sourceMode=WECHATPAY_SDK` 的审计元数据。
     - 验证方式：元数据字段完整性与类型检查。

- 现有测试稳定性保证（6/6 tests pass）：
  - 前 4 个测试继续通过（TOKEN、HMAC、无效签名、过期时间戳）。
  - 修复签名生成格式错误（`\\n` → `\n`），确保消息体正确。

验证与设计决策：

- `pnpm --filter @rbac/backend exec node --import tsx --test test/services/petpal-callback-auth.test.ts` 通过（6/6）。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（5/5）。
- `pnpm --filter @rbac/backend lint` 通过（Prisma + TypeScript）。
- Git commit：`feat(p0): add SDK failure path tests and fix signature formatting (slice 12)`。

关键设计决策：

- **向后兼容性**：SDK 模式是可选配置项，TOKEN 与 HMAC 模式不受影响。
- **测试环境与生产环境分离**：测试中 SDK 不可用（使用虚拟密钥触发 OpenSSL 错误），生产环境应使用官方 SDK 与有效公钥证书。
- **审计链完整性**：无论 SDK 验证成功或失败，都会创建 CallbackAudit 记录（见 Slice 10），便于问题追踪。

已识别的优化空间：

- 后续可集成官方 WeChat Pay SDK，使用真实公钥进行端到端测试。
- 可添加性能基准测试（SDK vs HMAC 验证耗时）。
- 可添加 SDK 验证失败的重试与降级策略。

## 23. PetPal 管理端回调审计 UI（P0 Slice 11 Part 2）

**内容**：完成 Web 控制台回调审计页面，打通后端查询 API 与前端可视化查询能力。

核心实现：

- 新增页面 `apps/web-frontend/src/pages/console/petpal/CallbackAuditView.vue`：
  - 列表 + 侧栏双栏工作台布局。
  - 筛选条件、分页状态通过 `usePageState` 维持。
  - 页面指标：总量、成功/失败回调、支付/退款占比、过滤摘要。
- 新增组件：
  - `CallbackAuditToolbar.vue`：多维筛选（类型/状态/来源/RequestId/时间范围）。
  - `CallbackAuditTable.vue`：分页列表与详情入口。
  - `CallbackAuditDetailDrawer.vue`：回调详情、关联支付/退款、验证结果树、原始载荷。
  - `CallbackAuditWorkbenchSidebar.vue`：选中记录摘要与关键指标卡。
- 新增展示辅助 `callback-audit-display.ts`：
  - 类型/状态/来源文案映射。
  - 时间格式化、过滤 token 生成、回调时间排序。
- 共享契约扩展（`packages/api-common`）：
  - 类型：`CallbackAuditRecord`、`CallbackAuditQuery`、`CallbackAuditPage`。
  - API：`api.petpal.admin.callbackAudits(query)`。
- 菜单接入（后端默认系统菜单）：
  - `apps/backend/src/services/system-rbac.ts` 新增 `viewKey: callback-audit` 菜单项。
  - 路径 `/petpal/callback-audits`，权限复用 `audit.read`。

验证与设计决策：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- 关键设计：严格对齐后端返回结构（`pagination`）避免前后端分页字段错配。

已识别的优化空间：

- 下一步增加统计聚合接口，避免前端在单页数据上做近似统计。
- 增加导出功能（CSV/JSON）并附带筛选条件快照。
- 引入权限细分（如 `petpal.audit.read`）替代复用 `audit.read`。

## 24. PetPal 回调审计统计与导出（P0 Slice 11 Part 3）

**内容**：新增回调审计聚合统计与导出接口，并接入管理端页面。

核心实现：

- 服务层（`apps/backend/src/services/petpal-service.ts`）：
  - `queryCallbackAuditStats(filters)`：返回 `total`、`successRate`、`byStatus`、`byType`、`bySourceMode`。
  - `listCallbackAuditExportRows(filters)`：导出记录查询，包含支付/退款关联信息（上限 5000 条）。
  - 抽取 `buildCallbackAuditWhere` 统一 where 构建，避免列表/统计/导出逻辑分叉。
- 路由层（`apps/backend/src/routes/petpal.ts`）：
  - 新增 `GET /api/petpal/admin/callback-audits/stats`。
  - 新增 `GET /api/petpal/admin/callback-audits/export`（Excel 导出）。
  - 使用统一解析函数 `parseCallbackAuditQuery`。
- 共享契约（`packages/api-common`）：
  - 新增 `CallbackAuditStats`。
  - 新增 `api.petpal.admin.callbackAuditStats()`。
  - 新增 `api.petpal.admin.exportCallbackAudits()`。
- 前端页面（`apps/web-frontend/src/pages/console/petpal/CallbackAuditView.vue`）：
  - 接入统计 API 驱动指标展示。
  - 接入 `ListExportButton` 调用导出接口。
- 权限/菜单：
  - 新增权限码 `petpal.callback-audit.read`。
  - 新增权限码 `petpal.callback-audit.export`。
  - 菜单节点 `callback-audit` 绑定新权限，修复 MenuNode 权限唯一约束冲突。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（5/5）。

测试补强（本轮增量）：

- `apps/backend/test/integration/petpal-api.test.ts` 新增用例：
  - 覆盖 `/api/petpal/admin/callback-audits/stats` 聚合统计返回结构。
  - 覆盖 `/api/petpal/admin/callback-audits/export` Excel 导出响应（content-type/content-disposition/二进制体）。
  - 覆盖非管理员访问管理端回调审计接口返回 403（列表/统计/导出）。
  - 覆盖运营经理访问边界：可读列表/统计，禁止导出（403）。
- `petpal-api` 集成测试总数由 5 提升到 8，回归结果 8/8 通过。

关键设计决策：

- 统一过滤解析 + where 复用，确保列表与统计口径一致。
- 保持接口行为向后兼容，避免影响已有回归用例。

安全加固（本轮增量）：

- `apps/backend/src/routes/petpal.ts` 的管理端回调审计接口（列表/统计/导出）统一增加 `requirePermission('petpal.callback-audit.read')`。
- 集成测试管理端用例改为使用管理员账号认证，确保权限边界可回归验证。
- 在此基础上将导出接口权限从读取权限拆分，改为 `requirePermission('petpal.callback-audit.export')`。

## 25. PetPal P0 最终验收（本轮）

**范围**：Slice 10、Slice 11 Part 1/2/3、Slice 12。

验收结果：

- 核心功能：完成。
- 回调审计链路：完成（持久化、查询、统计、导出、UI 可视化）。
- 质量门禁：通过（后端 lint、前端 lint、PetPal 集成测试）。
- 文档与进度：已同步。

遗留风险（P1 关注）：

- 统计/导出已具备集成测试覆盖，后续需补充压力与边界数据规模测试。
- 回调审计路由鉴权可继续按业务角色细分。

## 26. PetPal 回调审计 UI 导出权限对齐（P0 Slice 11 Part 4）

**内容**：将管理端回调审计页面导出按钮与后端导出权限进行前端显隐对齐，减少无权限用户误操作。

变更摘要：

- 前端页面 `apps/web-frontend/src/pages/console/petpal/CallbackAuditView.vue`：
  - 导出按钮 `ListExportButton` 增加 `v-permission="'petpal.callback-audit.export'"`。
- 权限边界一致性：
  - 具备 `petpal.callback-audit.read` 但不具备 `petpal.callback-audit.export` 的角色（如 manager）可继续使用查询/统计；导出入口不再展示。

验证结果：

- `pnpm --filter @rbac/web-frontend lint` 通过。
- 结合既有后端集成测试（8/8）确认读导权限拆分边界保持稳定。

Git commit：`feat(p0): align callback audit export button visibility with export permission`。

## 27. PetPal 回调审计保留清理任务（P1 Slice 1）

**内容**：新增 PetPal 回调审计保留治理任务，每日离峰清理超过 90 天的数据，降低审计表膨胀风险。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - 新增 `purgeExpiredCallbackAudits(olderThanDays = 90)`，按 `createdAt` 删除过期记录并返回删除统计。
- `apps/backend/src/timers/petpal-callback-audit-retention.timer.ts`
  - 新增 cron 定时任务（`20 3 * * *`，Asia/Shanghai），执行回调审计清理。
- `apps/backend/src/timers/index.ts`
  - 将新定时任务接入统一 timer registry。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（8/8）。

风险与后续：

- 当前策略为“过期删除”，后续可演进为“冷热分层 + 归档存储”。
- 若业务需要长期取证，可在清理前先导出到对象存储并记录归档索引。

Git commit：`feat(p1): add callback audit retention cleanup timer`。

## 28. PetPal 回调审计清理任务配置化（P1 Slice 2）

**内容**：将回调审计清理任务从硬编码升级为可配置运行，便于多环境部署与运维调优。

变更摘要：

- `apps/backend/src/config/env.ts`
  - 新增环境变量：
    - `PETPAL_CALLBACK_AUDIT_RETENTION_ENABLED`
    - `PETPAL_CALLBACK_AUDIT_RETENTION_DAYS`
    - `PETPAL_CALLBACK_AUDIT_RETENTION_CRON`
- `apps/backend/src/timers/petpal-callback-audit-retention.timer.ts`
  - 定时任务启停、保留天数、cron 表达式改为读取 env。
- `apps/backend/.env.example`
  - 同步新增变量模板与默认值。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。

Git commit：`feat(p1): make callback audit retention timer configurable`。

## 29. PetPal 回调失败告警 Outbox 重试闭环（P1 Slice 3）

**内容**：新增 PetPal 回调失败告警 outbox，打通失败入队、定时投递、失败重试和死信终止。

变更摘要：

- 数据层：
  - `apps/backend/prisma/models/petpal.prisma` 新增 `CallbackAlertOutbox` 模型。
  - 新增迁移 `apps/backend/prisma/migrations/20260401090000_add_callback_alert_outbox/migration.sql`。
  - `apps/backend/prisma/seed-data.ts` 追加 outbox 表清空，确保 seed 幂等。
- 业务层：
  - `apps/backend/src/services/petpal-service.ts` 在回调失败路径入队 outbox。
  - `apps/backend/src/services/petpal-callback-alert-outbox.ts` 新增派发器：
    - 批量消费、原子抢占、成功置 SENT。
    - 失败指数退避重试。
    - 达最大重试置 DEAD。
- 实时通道：
  - `packages/api-common/src/types/realtime.ts` 新增 `petpalCallbackAlert` topic 与 payload 类型。
  - `apps/backend/src/lib/socket.ts` 新增 `emitPetPalCallbackAlert`。
  - `apps/backend/src/topics/petpal.ts` 注册新主题。
  - `apps/backend/src/topics/index.ts` 汇总注册新主题。
  - `apps/backend/src/constants/system-permissions.ts` 新增订阅权限 `realtime.topic.petpal-callback-alert.subscribe`。
- 调度层：
  - 新增 `apps/backend/src/timers/petpal-callback-alert-outbox.timer.ts`。
  - `apps/backend/src/timers/index.ts` 接入定时器。
  - `apps/backend/src/config/env.ts`、`apps/backend/.env.example` 新增 outbox 调度参数。
- 测试：
  - `apps/backend/test/integration/petpal-api.test.ts` 增加支付/退款失败回调 outbox 入队断言。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（8/8）。

风险与后续：

- 当前 outbox 投递目标为实时通道，后续可扩展短信/企业微信/邮件多通道。
- 死信（DEAD）已可识别，后续应补管理端死信重放与巡检面板。

Git commit：`feat(p1): add callback failure alert outbox retry pipeline`。

## 30. PetPal 回调告警 Outbox 管理 API（P1 Slice 4）

**内容**：新增回调告警 outbox 的管理端查询、统计与手动重试 API，补齐死信治理操作面。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - 新增：
    - `GET /api/petpal/admin/callback-alert-outbox`
    - `GET /api/petpal/admin/callback-alert-outbox/stats`
    - `POST /api/petpal/admin/callback-alert-outbox/:id/retry`
  - 分别绑定 `petpal.callback-alert.read` 与 `petpal.callback-alert.retry` 权限。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 outbox 列表、统计、手动重试服务方法。
- `apps/backend/src/constants/system-permissions.ts`
  - 新增 `petpal.callback-alert.read`、`petpal.callback-alert.retry`。
- `apps/backend/src/services/system-rbac.ts`
  - manager 角色排除 `petpal.callback-alert.retry`。
- `packages/api-common/src/types/petpal.ts`
  - 新增 outbox 记录/查询/分页/统计类型。
- `packages/api-common/src/api/factory.ts`
  - 新增 outbox 列表、统计、重试 API 工厂方法。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增管理员 outbox 管理能力验证。
  - 新增 non-admin 与 manager 权限边界验证。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（9/9）。

Git commit：`feat(p1): add callback alert outbox admin APIs with permission boundaries`。

## 31. PetPal 回调告警 Outbox 控制台页面（P1 Slice 5）

**内容**：新增回调告警 outbox Web 管理页面，并接入菜单权限，完成运维端可视化闭环。

变更摘要：

- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 新增 outbox 列表页：状态筛选、分页、状态聚合、行级重试。
  - 重试操作使用 `v-permission='petpal.callback-alert.retry'` 做前端权限控制。
- `apps/backend/src/services/system-rbac.ts`
  - 新增菜单节点 `petpal-callback-alert-outbox`，绑定 `petpal.callback-alert.read`。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（9/9）。

Git commit：`feat(p1): add callback alert outbox console page and menu integration`。

## 32. PetPal 死信批量重放能力（P1 Slice 6）

**内容**：新增回调告警 outbox 死信批量重放 API 与前端一键重试入口，提升死信处理效率。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - 新增 `POST /api/petpal/admin/callback-alert-outbox/retry-dead`。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 `retryDeadCallbackAlertOutboxes(limit)`，仅重放 `DEAD` 状态消息。
- `packages/api-common/src/api/factory.ts`
  - 新增 `retryDeadCallbackAlertOutbox(limit?)` 客户端方法。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 新增“重试死信（最多 50 条）”按钮，权限控制 `petpal.callback-alert.retry`。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增 admin 批量重放成功断言。
  - 新增 member/manager 对批量重放接口的 403 边界断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（9/9）。

Git commit：`feat(p1): support batch retry for dead callback alert outbox records`。

## 33. PetPal 回调并发事务隔离加固（P1 Slice 7）

**内容**：针对支付/退款回调并发竞态，引入 Serializable 事务与冲突自动重试机制。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - 新增 `runSerializableTransaction` 事务执行器。
  - 统一开启 `TransactionIsolationLevel.Serializable`。
  - 识别 Prisma 冲突错误 `P2034`，最多自动重试 2 次。
  - `handlePaymentCallback`、`handleRefundCallback` 改为通过该执行器运行。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（9/9）。

Git commit：`feat(p1): harden petpal callback transactions with serializable isolation and retry`。

## 34. PetPal activeRole 越权防护（P1 Slice 8）

**内容**：将 activeRole 校验下沉到后端，阻断角色上下文伪造导致的越权访问风险。

变更摘要：

- `apps/backend/src/middlewares/auth.ts`
  - 新增 `x-active-role-id` 解析。
  - local/oAuth 鉴权链路都透传 activeRoleId 到用户上下文构建逻辑。
- `apps/backend/src/utils/rbac.ts`
  - `buildCurrentUser` 支持 `activeRoleId` 参数。
  - activeRole 必须属于当前用户，否则拒绝。
  - activeRole 有效时权限集合按角色收敛。
  - 返回用户上下文增加 `activeRole`。
- `packages/api-common/src/types/auth.ts`
  - `CurrentUser` 新增 `activeRole` 字段。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增 activeRole 篡改与合法角色上下文边界测试。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：`feat(p1): enforce server-side active role validation and scoped permissions`。

## 35. PetPal 重放审计轨迹（P1 Slice 9）

**内容**：新增回调告警 outbox 重放日志能力，覆盖单条重放与批量死信重放的可追溯记录。

变更摘要：

- 数据层：
  - `apps/backend/prisma/models/petpal.prisma` 新增 `CallbackAlertReplayLog`。
  - 新增迁移 `apps/backend/prisma/migrations/20260401103000_add_callback_alert_replay_log/migration.sql`。
  - `apps/backend/prisma/seed-data.ts` 新增 replay log 表清理。
- 服务层：
  - `apps/backend/src/services/petpal-service.ts`
    - 单条/批量重放写入 replay log。
    - 新增 `listCallbackAlertReplayLogs` 查询。
- 路由层：
  - `apps/backend/src/routes/petpal.ts`
    - 新增 `GET /api/petpal/admin/callback-alert-outbox/:id/replay-logs`。
    - 重放接口带入 `actorId` 进行审计归因。
- 共享契约与前端：
  - `packages/api-common/src/types/petpal.ts` 新增 replay log 类型。
  - `packages/api-common/src/api/factory.ts` 新增 replay log 查询方法。
  - `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue` 新增重放记录抽屉。
- 测试：
  - `apps/backend/test/integration/petpal-api.test.ts` 增加 replay log 断言与权限边界回归。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：`feat(p1): add callback alert replay logs for outbox requeue traceability`。
- 高增长场景下需要规划审计表分区与归档策略。

## 36. PetPal outbox 积压时长指标（P1 Slice 10）

**内容**：在回调告警 outbox 统计中新增积压时长可观测指标，用于快速识别处理延迟。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - `queryCallbackAlertOutboxStats` 增加：
    - `oldestPendingAgeMinutes`
    - `oldestDeadAgeMinutes`
  - 指标基于当前过滤条件，按最早创建时间计算分钟级时长。
- `packages/api-common/src/types/petpal.ts`
  - 扩展 `CallbackAlertOutboxStats` 共享类型。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 控制台统计卡新增“最老待处理(分钟)”与“最老死信(分钟)”。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 增加新统计字段的接口断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 47. PetPal replay 静默风险信号（P1 Slice 21）

**内容**：新增 replay 活动静默风险信号，支持可配置阈值并回传生效阈值。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - replay logs stats 查询新增 `staleThresholdMinutes` 参数。
- `apps/backend/src/services/petpal-service.ts`
  - replay stats 新增 `staleThresholdMinutes` 与 `isReplayStale`。
  - 判定逻辑基于 `minutesSinceLastReplay` 与阈值比较，默认阈值 30 分钟。
- `packages/api-common/src/types/petpal.ts`
  - replay query/stats 类型新增静默阈值与静默风险字段。
- `packages/api-common/src/api/factory.ts`
  - replay stats 客户端透传静默阈值参数。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉统计区展示静默阈值标签，并在静默超阈值时显示告警标签。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增静默字段类型断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 48. PetPal 开发计划重排（审计后）

**内容**：基于当前实现审计结果，开发重心从“回调治理增强”切换为“三端核心功能补齐”，并明确 2026-04-01 至 2026-05-06 的里程碑排期。

计划摘要：

- 2026-04-01 至 2026-04-05：P1-M1 照料者入驻与资质。
- 2026-04-06 至 2026-04-10：P1-M2 接单履约链路。
- 2026-04-11 至 2026-04-15：P1-M3 用户反馈与售后。
- 2026-04-16 至 2026-04-20：P1-M4 管理治理闭环。
- 2026-04-21 至 2026-05-06：P2 联调测试与论文素材沉淀。

完成标准统一要求：

- 每个切片同步更新进度文档（完成项/进行中/风险/下一步）。
- 每个切片通过门禁（api-common build、backend lint、web-frontend lint、PetPal 定向集成测试）。
- 每个切片独立 commit 并可追踪到文档记录。

## 49. PetPal 照料者入驻与服务设置（P1-M1 Slice 22）

**内容**：实现照料者档案维护、服务项配置与管理员审核接口，补齐服务端第一段核心能力。

变更摘要：

- `packages/api-common/src/types/petpal.ts`
  - 新增照料者档案/服务设置/审核相关类型。
- `packages/api-common/src/api/factory.ts`
  - 新增 caregiver 端 profile/services 方法与 admin 审核方法。
- `apps/backend/src/constants/system-permissions.ts`
  - 新增权限 `petpal.caregiver.audit`。
- `apps/backend/src/services/petpal-service.ts`
  - 新增照料者档案懒创建、更新、服务创建/更新/查询、管理员审核逻辑。
- `apps/backend/src/routes/petpal.ts`
  - 新增 6 个接口：
    - `GET/PUT /api/petpal/caregiver/profile`
    - `GET/POST/PUT /api/petpal/caregiver/services` 及 `:id`
    - `POST /api/petpal/admin/caregivers/:id/audit`
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增照料者入驻与管理员审核集成用例；member 审核权限拒绝断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（11/11）。

Git commit：待本切片提交。

## 50. PetPal Web 接入照料者入驻（P1-M1 Slice 23）

**内容**：将已落地的照料者档案与服务设置 API 接入 Web 前台，形成可操作页面。

变更摘要：

- `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue`
  - 新增照料者档案编辑区（intro/experienceYears/serviceRadiusKm/serviceCity）。
  - 新增照料者审核状态展示。
  - 新增照料服务创建表单与服务列表展示。
  - 页面初始化与刷新逻辑接入 caregiver profile/services 并行加载。

验证结果：

- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。

Git commit：待本切片提交。

## 51. PetPal 管理端照料者审核台（P1-M1 Slice 24）

**内容**：新增管理员照料者审核列表查询能力与控制台审核页面，形成管理端审核闭环入口。

变更摘要：

- `packages/api-common/src/types/petpal.ts`
  - 新增 `CaregiverAuditQuery`、`CaregiverAuditListItem`、`CaregiverAuditPage`。
- `packages/api-common/src/api/factory.ts`
  - 新增 `petpal.admin.caregiverAudits(query)`。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 `queryCaregiverAuditList`，支持分页、审核状态、城市、关键字筛选。
- `apps/backend/src/routes/petpal.ts`
  - 新增 `GET /api/petpal/admin/caregivers`（权限：`petpal.caregiver.audit`）。
  - 列表查询参数 schema 与分页参数兜底处理。
- `apps/backend/src/services/system-rbac.ts`
  - 新增控制台菜单：`/petpal/caregiver-audits`（`viewKey: caregiver-audit`）。
- `apps/web-frontend/src/pages/console/petpal/CaregiverAuditView.vue`
  - 新增审核台页面：筛选、列表、分页、审核动作（通过/拒绝/重置）。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增管理员审核列表查询断言。
  - 新增 member 访问管理员审核列表 403 断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（11/11）。

Git commit：待本切片提交。

## 52. PetPal 接单履约后端与 Web 工作台（P1-M2 Slice 25）

**内容**：实现照料者履约主链路的后端接口、订单时间线与服务日志模型，并在 Web 前台交付最小履约工作台。

变更摘要：

- `apps/backend/prisma/enums.prisma`
  - 新增 `OrderTimelineEventType`、`OrderOperatorRole`、`ServiceLogType`。
- `apps/backend/prisma/models/petpal.prisma`
  - `OrderMain` 新增 `timelines` / `serviceLogs` 关联。
  - `CaregiverProfile` 新增 `serviceLogs` 关联。
  - 新增 `OrderTimeline`、`ServiceLog` 两张履约表。
- `apps/backend/prisma/migrations/20260401123000_add_petpal_fulfillment_tables/migration.sql`
  - 新增履约表、索引、外键迁移。
- `packages/api-common/src/types/petpal.ts`
  - 新增履约相关共享类型。
  - 修正支付/退款枚举与后端实际值对齐。
- `packages/api-common/src/api/factory.ts`
  - 新增 caregiver 履约动作 API 与 owner 确认完成 API。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 caregiver 订单列表、接单、签到、服务记录、签退、业主确认完成服务方法。
  - 订单详情响应统一输出 `timeline`，修复内部实体 `timelines` 与外部契约不一致问题。
- `apps/backend/src/routes/petpal.ts`
  - 新增 6 个履约接口：
    - `GET /api/petpal/caregiver/orders`
    - `POST /api/petpal/caregiver/orders/:id/accept`
    - `POST /api/petpal/caregiver/orders/:id/check-in`
    - `POST /api/petpal/caregiver/orders/:id/service-logs`
    - `POST /api/petpal/caregiver/orders/:id/check-out`
    - `POST /api/petpal/orders/:id/confirm-complete`
- `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue`
  - 新增履约工作台与相关动作按钮。
  - 业主订单列表新增确认完成动作。
  - 修复状态筛选控件类型问题，使用空字符串哨兵值替代 `undefined`。
- `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`
  - 补齐新增枚举的前端展示映射。
- `apps/app-frontend/src/pages/order-detail/index.vue`
  - 同步补齐移动端详情映射。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增履约链路集成测试，覆盖成功路径与重复签到失败路径。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（12/12）。

Git commit：待本切片提交。

## 53. PetPal 订单详情履约可视化（P1-M2 Slice 26）

**内容**：将履约时间线与服务记录接入订单详情页面，补齐主人端和移动端的履约过程可视化，并增加一条业主详情契约断言。

变更摘要：

- `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`
  - 新增履约时间线区块，展示事件标签、操作角色、记录时间、状态流转、备注、业务时间、媒体数量、定位坐标。
  - 新增服务记录区块，展示记录类型、服务时间、备注、媒体数量、定位坐标与上传时间。
- `apps/app-frontend/src/pages/order-detail/index.vue`
  - Uni 端同步新增履约时间线和服务记录展示，保证双端订单详情结构一致。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 在履约主路径测试中增加业主详情断言，校验详情接口返回完整 `timeline` / `serviceLogs` 痕迹。

验证结果：

- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/app-frontend type-check` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（12/12）。

Git commit：待本切片提交。

## 54. PetPal 履约守卫与失败分支测试（P1-M2 Slice 27）

**内容**：统一履约入口的“审核通过照料者”前置守卫，并补齐履约状态机失败分支的定向集成测试。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - 新增 `getApprovedCaregiverProfile`，集中校验照料者档案存在且 `auditStatus=APPROVED`。
  - `listCaregiverOrders` 改为先校验审核状态，再查询履约列表。
  - `acceptCaregiverOrder`、`checkInCaregiverOrder`、`addCaregiverServiceLog`、`checkOutCaregiverOrder` 改为统一复用上述守卫。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增 `createFulfillmentScenario` 测试夹具。
  - 新增未审核照料者、非关联照料者、状态逆行、空服务记录等失败分支断言。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（14/14）。

Git commit：待本切片提交。

## 55. PetPal Web 服务日志媒体上传（P1-M2 Slice 28）

**内容**：复用现有 managed upload 链路，为照料者服务日志补齐 Web 端媒体上传、进度展示和订单详情媒体预览。

变更摘要：

- `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue`
  - 将服务记录入口从简单文本 prompt 升级为对话框编辑器。
  - 新增服务记录类型选择、媒体文件列表、移除操作与整体上传进度条。
  - 复用 `uploadAttachmentFile(file, { tag1: 'petpal-service-log', tag2: orderId })` 上传服务日志媒体。
  - 按 `file.upload` 权限控制媒体上传入口；无权限时保留纯文本记录能力。
- `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`
  - 服务记录列表新增图片缩略图预览。
  - 非图片媒体改为附件卡片并支持直接打开。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 履约主路径测试新增 `mediaUrls` 输入与返回断言，确保服务日志媒体在履约返回与业主详情中都可见。

验证结果：

- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（14/14）。

Git commit：待本切片提交。

## 56. PetPal Uni 服务记录媒体预览（P1-M2 Slice 29）

**内容**：为 Uni 端订单详情补齐服务记录媒体展示与交互，移动端不再停留在“媒体数量”层面。

变更摘要：

- `apps/app-frontend/src/pages/order-detail/index.vue`
  - 服务记录区新增媒体卡片网格。
  - 图片媒体支持 `uni.previewImage(...)` 预览。
  - 非图片媒体展示附件名称，并在 H5 端直接打开、非 H5 端复制链接兜底。
  - 新增移动端媒体卡片样式，保证缩略图、文件名和提示文案可读。

验证结果：

- `pnpm --filter @rbac/app-frontend type-check` 通过。

Git commit：待本切片提交。

## 57. PetPal 服务日志媒体上传权限闭环（P1-M2 Slice 30）

**内容**：修复服务日志媒体上传只对 `file.upload` 角色可用的问题，在不放开通用附件上传的前提下，为审核通过且订单归属正确的照料者开放 `petpal-service-log` 白名单上传。

变更摘要：

- `apps/backend/src/routes/files.ts`
  - 新增 `petpal-service-log` 上传白名单校验。
  - 仅在 `tag1=petpal-service-log`、`tag2=orderId`、照料者档案审核通过、订单归属正确且状态允许时，放行附件预签名与回调。
  - 通用附件上传权限模型保持不变，普通成员依然不能上传任意业务附件。
- `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue`
  - 服务日志媒体上传入口判断从“仅 `file.upload`”调整为“`file.upload` 或照料者审核通过”。
  - 无资格提示文案同步调整。
- `apps/backend/test/integration/files.test.ts`
  - 新增定向集成测试，覆盖普通成员通用附件拒绝、错误订单拒绝、正确订单白名单上传成功。

验证结果：

- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test test/integration/files.test.ts` 通过（2/2）。
- `pnpm --filter @rbac/web-frontend lint` 通过。

Git commit：待本切片提交。

## 58. PetPal 订单评价闭环首版（P1-M3 Slice 31）

**内容**：启动 P1-M3 用户反馈能力，先落地“主人对已完成订单提交一次评价”的最小闭环，并将结果回写到照料者评分统计与订单详情页。

变更摘要：

- `apps/backend/prisma/models/auth.prisma`
  - 用户新增 `petpalReviews` 反向关系，供订单评价记录归属使用。
- `apps/backend/prisma/models/petpal.prisma`
  - `CaregiverProfile` 新增 `reviews` 关系。
  - `OrderMain` 新增 `review` 单条关联。
  - 新增 `Review` 模型，包含评分、标签、文字、匿名标记与软删除字段。
- `apps/backend/prisma/migrations/20260401183000_add_petpal_review_table/migration.sql`
  - 新增 `Review` 表、唯一约束、索引与外键。
- `packages/api-common/src/types/petpal.ts`
  - 新增 `OrderReviewRecord`、`CreateOrderReviewPayload`。
  - `OrderDetailRecord` 扩展 `review` 字段。
- `packages/api-common/src/api/factory.ts`
  - 新增 `api.petpal.orders.review(id, payload)`。
- `apps/backend/src/routes/petpal.ts`
  - 新增 `POST /api/petpal/orders/:id/review` 路由与参数校验。
- `apps/backend/src/services/petpal-service.ts`
  - 订单详情查询补齐 `review` 关联。
  - 新增主人评价创建逻辑：
    - 仅允许订单主人操作
    - 仅允许已完成订单评价
    - 一单只能评价一次
    - 提交后同步更新照料者 `ratingAvg` / `ratingCount`
- `apps/backend/test/integration/petpal-api.test.ts`
  - 履约主路径补充评价成功、重复评价失败、详情回读、评分统计更新断言。
  - 异常路径补充未完成订单禁止评价断言。
- `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`
  - 订单详情新增评价区块。
  - 主人可在已完成且未评价订单上打开弹窗提交评分、标签、文字与匿名选项。
  - 已评价订单支持直接展示评分内容。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。

Git commit：待本切片提交。

## 59. PetPal 主人投诉发起与进度查看（P1-M3 Slice 32）

**内容**：继续推进 P1-M3 用户反馈能力，补齐主人端投诉发起、投诉进度查看，以及投诉触发订单进入 `DISPUTED` 的主链路。

变更摘要：

- `apps/backend/prisma/enums.prisma`
  - `OrderTimelineEventType` 新增 `DISPUTED`。
  - 新增投诉相关枚举：
    - `ComplaintTargetRole`
    - `ComplaintType`
    - `ComplaintStatus`
    - `ComplaintActionType`
- `apps/backend/prisma/models/auth.prisma`
  - `User` 新增投诉人与投诉处理日志反向关系。
- `apps/backend/prisma/models/petpal.prisma`
  - `OrderMain` 新增 `complaints` 关系。
  - 新增 `Complaint` 模型，包含投诉对象、投诉类型、证据链接、状态与结案信息。
  - 新增 `ComplaintProcessLog` 模型，用于记录投诉处理进度。
- `apps/backend/prisma/migrations/20260401193000_add_petpal_complaint_tables/migration.sql`
  - 新增投诉与处理日志表、索引、外键及数据库枚举。
- `packages/api-common/src/types/petpal.ts`
  - 新增投诉相关类型与 `CreateComplaintPayload`。
- `packages/api-common/src/api/factory.ts`
  - 新增：
    - `api.petpal.orders.complaints(id)`
    - `api.petpal.orders.createComplaint(id, payload)`
- `apps/backend/src/routes/petpal.ts`
  - 新增：
    - `GET /api/petpal/orders/:id/complaints`
    - `POST /api/petpal/orders/:id/complaints`
- `apps/backend/src/services/petpal-service.ts`
  - 新增主人投诉查询与创建逻辑。
  - 投诉创建规则：
    - 仅订单主人可操作
    - 仅服务中或已结算订单可投诉
    - 同一订单仅允许一个活跃投诉
    - 创建投诉后自动写入首条 `ComplaintProcessLog`
    - 订单状态推进为 `DISPUTED` 并写入时间线事件
- `apps/backend/test/integration/petpal-api.test.ts`
  - 履约主路径补充投诉成功、重复投诉失败、投诉列表回读、订单状态与时间线更新断言。
  - 异常路径补充不允许投诉状态下的 400 断言。
- `apps/web-frontend/src/pages/frontend/petpal/OrderDetailView.vue`
  - 主人端订单详情新增投诉与进度区块。
  - 新增投诉弹窗表单与投诉列表展示。
  - 新增投诉证据链接展示与投诉进度日志展示。
  - 时间线新增 `DISPUTED` 事件展示。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。

Git commit：待本切片提交。

## 60. PetPal 主人近一年交易导出（P1-M3 Slice 33）

**内容**：补齐主人侧交易记录导出能力，允许登录用户导出近一年本人订单的交易概览，并复用现有 Excel 下载链路。

变更摘要：

- `packages/api-common/src/types/petpal.ts`
  - 新增 `OwnerTransactionExportQuery`，用于约定导出时间窗参数。
- `packages/api-common/src/api/factory.ts`
  - 新增 `api.petpal.orders.exportTransactions(query)` 下载端点。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 `listOwnerTransactionExportRows()`。
  - 使用 `getRequestActorId()` 从请求上下文读取当前用户并限定 `ownerId`。
  - 默认导出最近 365 天，限制查询时间范围不超过 366 天。
  - 导出数据聚合订单、支付、退款、投诉与评价概览字段。
- `apps/backend/src/routes/petpal.ts`
  - 新增 `GET /api/petpal/orders/transactions/export`。
  - 复用 `createExcelExportHandler` 生成 Excel。
  - 导出列采用中文标题。
  - 路由注册位置放在 `/orders/:id` 之前，避免动态路由吞掉导出路径。
- `apps/web-frontend/src/pages/frontend/petpal/PetPalOwnerView.vue`
  - “需求与订单”区块新增“导出近一年交易”按钮。
  - 复用 `ListExportButton`，移动端窄屏下自动换行。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增主人交易导出集成测试：
    - 校验响应头与工作表标题
    - 校验导出结果仅包含当前主人订单
    - 校验超范围时间窗返回 400

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（15/15）。
- `pnpm --filter @rbac/web-frontend lint` 通过。

代码审计结论：

- 已确认导出服务按请求用户作用域裁剪，不会跨用户泄露订单。
- 已确认导出路由位于动态详情路由之前，避免 `/orders/:id` 误匹配导出路径。

Git commit：待本切片提交。

## 46. PetPal replay 主导阈值可配置（P1 Slice 20）

**内容**：将 replay 风险主导判定从固定阈值升级为可配置阈值，并在 stats 回传生效阈值。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - replay logs stats 查询支持 `dominanceThreshold` 与 `dominanceMinSamples`。
- `apps/backend/src/services/petpal-service.ts`
  - replay 主导判定改为使用可配置阈值（默认 0.7/5）。
  - stats 响应新增 `dominanceThreshold`、`dominanceMinSamples` 回传。
- `packages/api-common/src/types/petpal.ts`
  - replay query/stats 类型扩展阈值字段。
- `packages/api-common/src/api/factory.ts`
  - replay stats 客户端透传阈值参数。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉统计区新增阈值标签，并使用默认阈值请求 stats。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增 replay stats 阈值字段类型断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm --filter @rbac/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 45. PetPal replay log 时效信号（P1 Slice 19）

**内容**：在 replay log 统计中新增“最近重放时间”和“距今分钟数”，提升值班诊断效率。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - replay stats 新增 `latestReplayAt` 与 `minutesSinceLastReplay`。
  - 基于最新 `createdAt` 计算分钟差，空样本返回 null。
- `packages/api-common/src/types/petpal.ts`
  - replay stats 类型同步新增字段。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉统计区新增时效标签。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增时效字段类型断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 44. PetPal replay log 风险信号增强（P1 Slice 18）

**内容**：在 replay log 统计中新增“批量重放占比”与“批量主导告警”指标，提升治理可视化能力。

变更摘要：

- `apps/backend/src/services/petpal-service.ts`
  - `queryCallbackAlertReplayLogStats` 新增：
    - `batchReplayRatio`
    - `isBatchReplayDominant`
  - 判定阈值：总样本 >= 5 且批量占比 >= 70%。
- `packages/api-common/src/types/petpal.ts`
  - replay stats 类型新增上述字段。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉统计区显示批量占比与危险提示标签。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增统计字段类型断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 43. PetPal replay log 统计能力（P1 Slice 17）

**内容**：新增 callback alert replay log 统计接口，并在管理端抽屉展示动作分布与操作人规模。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - 新增 replay logs stats 接口：
    - `GET /api/petpal/admin/callback-alert-outbox/:id/replay-logs/stats`
- `apps/backend/src/services/petpal-service.ts`
  - 新增 `queryCallbackAlertReplayLogStats`，返回总量、按动作分布、操作人去重数。
- `packages/api-common/src/types/petpal.ts`
  - 新增 `CallbackAlertReplayLogStats`。
- `packages/api-common/src/api/factory.ts`
  - 新增 replay logs stats 客户端调用方法。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉新增统计标签并与列表查询并行加载。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 新增 stats 接口数据断言与权限边界断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 42. PetPal replay log 导出权限拆分（P1 Slice 16）

**内容**：将 callback alert replay log 导出从 read 权限拆分为独立 export 权限，强化最小授权策略。

变更摘要：

- `apps/backend/src/constants/system-permissions.ts`
  - 新增 `petpal.callback-alert.export`。
- `apps/backend/src/services/system-rbac.ts`
  - manager 默认排除 `petpal.callback-alert.export`。
- `apps/backend/src/routes/petpal.ts`
  - replay log 导出接口改为 `requirePermission('petpal.callback-alert.export')`。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 导出按钮添加导出权限门控。
- `apps/backend/test/integration/petpal-api.test.ts`
  - manager 导出预期改为 403。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 41. PetPal replay log 导出能力（P1 Slice 15）

**内容**：新增 callback alert outbox replay log Excel 导出，支持按 outbox 与筛选条件导出。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - 新增 `GET /api/petpal/admin/callback-alert-outbox/replay-logs/export`。
  - 导出参数支持 `outboxId/actionType/actorId/startDate/endDate`。
- `apps/backend/src/services/petpal-service.ts`
  - 新增 `listCallbackAlertReplayLogExportRows`，并将导出数量上限控制为 5000。
- `packages/api-common/src/types/petpal.ts`
  - replay log query 扩展 `outboxId`。
- `packages/api-common/src/api/factory.ts`
  - 新增 replay log 导出下载端点。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 重放记录抽屉新增导出按钮并复用当前筛选条件。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 增加 replay log 导出权限边界断言（member 403 / manager 200）。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 40. PetPal replay log 分页查询（P1 Slice 14）

**内容**：将 callback alert outbox replay logs 从列表接口升级为分页接口，支持管理端抽屉翻页巡检。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - replay logs 查询参数改为 `page/pageSize`。
- `apps/backend/src/services/petpal-service.ts`
  - replay logs 返回 `items + pagination` 分页结构。
  - 增加总数统计并支持 skip/take。
- `packages/api-common/src/types/petpal.ts`
  - 新增 `CallbackAlertReplayLogPage`，扩展 replay log query 分页字段。
- `packages/api-common/src/api/factory.ts`
  - replay logs API 返回类型改为分页对象。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉新增分页控件与页码切换逻辑。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 回放日志断言更新为分页结构。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 39. PetPal replay log 时间范围筛选（P1 Slice 13）

**内容**：在 callback alert outbox replay log 查询中新增时间窗过滤能力，支持按时间段定位重放记录。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - replay logs 查询参数新增 `startDate`、`endDate`。
- `apps/backend/src/services/petpal-service.ts`
  - replay logs 查询增加 `createdAt` 时间范围过滤。
- `packages/api-common/src/types/petpal.ts`
  - 扩展 replay log query 类型字段。
- `packages/api-common/src/api/factory.ts`
  - replay logs 客户端调用透传时间参数。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉新增时间范围筛选控件。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 增加未来时间窗空结果断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 38. PetPal replay log 过滤查询（P1 Slice 12）

**内容**：为 callback alert outbox replay logs 增加动作类型和操作人过滤能力，提升重放排障效率。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - replay logs 查询参数新增 `actionType`、`actorId`。
- `apps/backend/src/services/petpal-service.ts`
  - `listCallbackAlertReplayLogs` 支持过滤条件。
- `packages/api-common/src/types/petpal.ts`
  - 新增 `CallbackAlertReplayLogQuery`。
- `packages/api-common/src/api/factory.ts`
  - replay logs 客户端调用改为 query 对象签名。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 抽屉新增筛选控件与筛选刷新动作。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 增加 replay logs 过滤断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。

## 37. PetPal outbox 处理中超时指标（P1 Slice 11）

**内容**：为 callback alert outbox 统计增加“处理中超时数量”，用于发现长时间停留在 PROCESSING 的积压消息。

变更摘要：

- `apps/backend/src/routes/petpal.ts`
  - outbox 统计查询新增 `processingTimeoutMinutes` 参数解析。
- `apps/backend/src/services/petpal-service.ts`
  - `queryCallbackAlertOutboxStats` 新增：
    - `stuckProcessingCount`
    - `processingTimeoutMinutes`
  - 阈值默认 10 分钟，限制范围 1~240。
- `packages/api-common/src/types/petpal.ts`
  - 扩展 outbox query/stats 共享类型。
- `apps/web-frontend/src/pages/console/petpal/CallbackAlertOutboxView.vue`
  - 新增“处理中超时(>N分钟)”统计卡并传入阈值参数。
- `apps/backend/test/integration/petpal-api.test.ts`
  - 增加新字段断言。

验证结果：

- `pnpm --filter @rbac/api-common build` 通过。
- `pnpm --filter @rbac/backend lint` 通过。
- `pnpm --filter @rbac/web-frontend lint` 通过。
- `pnpm -C apps/backend exec node --import tsx --test --test-concurrency=1 test/integration/petpal-api.test.ts` 通过（10/10）。

Git commit：待本切片提交。
