# Implementation History

Last updated: 2026-03-31

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
- 高增长场景下需要规划审计表分区与归档策略。
