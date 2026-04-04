# Project Memory

Last updated: 2026-04-04

## 1. 项目定位

这是一个面向长期演进的 RBAC / Console 基础工程，不是一次性 CRUD Demo。仓库目标是提供一套可以继续扩展为中后台、运营平台、SaaS 控制台或多端账号中心的统一底座。

当前目标包含：

- 真实的后端 RBAC 服务
- 对外可展示的 Web 前台
- 专业化的 Web 控制台
- 保持官方结构的 Uni 客户端接入位点
- 跨端共享的 API 请求与类型边界
- 具备审计、软删除、策略认证和后台 timer 的基础设施
- 当前主线业务已经明确收口到 PetPal，根级 `/petpal-admin/*` 正在承接平台治理工作区而不是继续停留在通用模板控制台。

## 2. 固定边界

### Monorepo 结构

- `apps/backend`
- `apps/web-frontend`
- `apps/app-frontend`
- `packages/api-common`

### 不应轻易改变的结构决策

- Web 继续维持 `frontend` 与 `console` 双命名空间。
- App 继续维持 unibest 官方结构。
- 后端 timer 统一在 `apps/backend/src/timers` 注册。
- 跨端契约继续由 `packages/api-common` 承担。

## 3. 当前技术栈

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis
- JWT
- bcrypt
- Socket.io
- S3 compatible storage
- toad-scheduler

### Web

- Vue 3
- TypeScript
- Element Plus
- Pinia
- Vue Router
- Vite
- UnoCSS / Iconify

### App

- uni-app
- unibest structure
- Wot UI
- Pinia

### Shared

- `packages/api-common`
  - API factory
  - fetch adaptor
  - uni adaptor
  - shared auth / rbac / file DTO
  - auth client header constants

## 4. 当前已实现状态

### 4.1 Backend

已实现：

- 认证：
  - 登录
  - 注册
  - 刷新令牌
  - 登出
  - 当前用户
  - 认证策略列表
  - 验证码发送
  - 验证码校验
- RBAC：
  - 用户 / 角色 / 权限 CRUD
  - 权限来源分析
  - 菜单树 CRUD
  - 当前用户可访问菜单树
- 其他：
  - dashboard summary
  - audit logs
  - realtime channel
  - avatar upload
  - upload reconcile timer
- PetPal 后台治理接口，已覆盖总览、投诉、违规处罚 / 整改附件直传与复核 / 处罚模板 / 单次申诉审核、照料者审核、回调审计 / 告警与平台规则草稿 / 发布 / 归档；附件中心也已能识别照料者资质材料、订单消息附件、订单投诉证据与处罚整改材料这四类 PetPal 业务引用，并在删除前做业务级拦截，同时会定时回收长期未被业务引用的临时资质/消息/投诉/整改附件，订单参与方现在也可按订单范围上传消息/投诉证据附件而不依赖通用 `file.upload`；当前后端上传白名单、孤儿附件清理定时器、处罚整改数量上限和相关集成测试也已统一改读 `@rbac/api-common` 中的 PetPal 附件共享常量，资质 / 消息 / 投诉 / 服务记录 / 整改附件口径进一步收拢，Web / App / backend 侧把上传结果或 `MediaAsset` 明细转换成 `ManagedAttachmentRecord` 的快照构造也已统一收口到共享 helper

### 4.2 认证模型

认证分两层：

1. `AuthClient`
   - 系统级客户端身份
   - 通过 `X-RBAC-Client-Code` 与 `X-RBAC-Client-Secret` 校验
2. `AuthStrategy`
   - 认证方式定义
   - 当前内置三种：
     - `username-password`
     - `email-code`
     - `phone-code`

相关模型：

- `AuthClient`
- `AuthStrategy`
- `UserAuthentication`
- `VerificationCode`
- `RefreshToken`

当前 seed：

- client：
  - `web-console`
  - `uni-wechat-miniapp`
- mock code：
  - 邮箱 `123456`
  - 手机 `654321`

### 4.3 数据层规则

受管实体默认具备：

- `id`
- `createId`
- `updateId`
- `createdAt`
- `updatedAt`
- `deleteAt`

当前语义：

- 主键统一雪花 ID
- `delete` -> `deleteAt`
- 查询默认排除逻辑删除
- 审计字段通过 Prisma 扩展自动处理

### 4.4 Web 前端

当前结构：

- `pages/frontend`
  - 项目首页
  - 系统架构页
  - 认证策略页
  - 404 页
- `pages/console`
  - 登录页
  - 仪表盘
  - 用户管理
  - 角色管理
  - 权限管理
  - 菜单结构管理
  - 审计日志
  - 权限来源分析
  - 实时协作
- `pages/petpal-admin`
  - 根级 PetPal 治理工作区
- 已承载总览、投诉治理、违规处罚 / 整改附件直传与复核 / 处罚模板 / 单次申诉审核、照料者审核、回调审计 / 告警与平台规则管理
- 控制台附件页已开始展示业务引用计数、引用来源摘要和详情引用卡片，引用中的附件会在列表、详情和右键菜单里同步禁删

当前特性：

- FrontendLayout / ConsoleLayout 分离
- 控制台路由集中在 `/console/**`
- 登录后动态注入菜单与控制台页面
- 工作台标签、布局偏好、页面过渡等状态持久化
- `v-permission` / `v-role`
- 页面目录下 `components` 子目录规范
- 搜索表单、列表、详情、编辑等细节从页面组件中下沉
- PetPal Web 订单详情页与跨订单消息中心的消息发送区也已对齐订单范围附件口径，当前可直接上传 `petpal-order-message + orderId` 图片附件，并支持发送前移除、线程内快捷回复、按线程保留草稿、失败恢复提示与历史附件查看；消息中心与订单详情沟通区现已共用按订单隔离的草稿 / 恢复态，并会落到本地存储，跨页面往返或刷新后都不会轻易丢失未发送内容，同时会自动淘汰过期或过多的旧线程缓存，并按主人 / 照料者作用域分别保留缓存容量，避免双身份互相挤占；当前本地缓存主键也已升级为“用户 + 角色 + 订单”复合 identity，同订单下不同账号或极端双角色读写不再互相串扰，旧版仅按 `orderId` 的匿名本地快照在首次命中时也会自动迁移到当前登录用户，而长期未被认领的匿名残留会在 24 小时内优先清理，已认领的用户级缓存仍维持 7 天保留窗口；此外 PetPal Web 现在只会在首次进入 `/petpal*` 路由时懒触发一次缓存 warmup，不再由全站主入口无差别拉起消息状态模块
- PetPal Web 订单详情页与跨订单消息中心上传成功后的消息附件快照当前也已改走 `@rbac/api-common` 共享 builder，不再在两页里重复手写 `fileId/url/name/mimeType/size` 映射。
- PetPal Web / App 两端的消息草稿附件类型当前也已开始对齐到共享 `ManagedAttachmentRecord` 结构；Web 端读取旧本地草稿时会为历史缺失的 `uploadedAt` 自动补齐回放时间戳，避免旧缓存因为字段升级直接失效。
- PetPal Web / App 两端的消息草稿状态当前也已开始复用 `@rbac/api-common` 里的共享附件 clone / parse helper；Web 端仍保留旧缓存缺失 `uploadedAt` 的回填策略，但附件对象级校验和复制口径已经不再分叉。
- PetPal Web / App 两端的消息草稿 / 恢复态类型、草稿深拷贝、草稿解析和恢复态解析当前也已继续收口到 `@rbac/api-common`；双端状态模块现在主要保留各自的本地存储介质、启动 warmup 和旧缓存迁移差异。
- PetPal Web / App 两端的消息草稿 identity、storage key、legacy adoption 和 scoped clear 纯函数当前也已继续收口到 `@rbac/api-common`；双端状态模块剩余的核心差异基本已收敛到存储介质读写和启动时机。

### 4.5 App 前端

当前方向：

- 保持 unibest 项目组织方式
- 复用 `api-common`
- 已包含登录 / 注册 / 首页 / 我的 / 权限相关接入位点
- PetPal 照料者资质材料上传已对齐后端受管附件口径，当前会使用 `petpal-caregiver-qualification + caregiverProfile.id` 作为上传标签
- PetPal 投诉证据上传已对齐订单范围附件口径，当前会使用 `petpal-order-complaint + orderId` 作为上传标签
- PetPal Web 投诉结果工作台里的投诉表单也已切到订单范围受管附件上传，当前不再手填证据 URL，而是先保留带 `fileId` / `url` / `name` / `size` 的本地附件快照后再提交既有 `evidenceUrls`
- PetPal App 订单详情页与跨订单消息中心的消息图片上传也已对齐订单范围治理标签，当前会使用 `petpal-order-message + orderId` 作为上传标签，并支持发送前预览、移除、按线程保留草稿、失败恢复提示与线程内快捷回复；消息中心与订单详情沟通区现已共用按订单隔离的草稿 / 恢复态，并会落到本地存储，跨页面往返或重新进入应用后都不会轻易丢失未发送内容，同时会自动淘汰过期或过多的旧线程缓存，并按主人 / 照料者作用域分别保留缓存容量，避免双身份互相挤占；当前本地缓存主键也已升级为“用户 + 角色 + 订单”复合 identity，同订单下不同账号或极端双角色读写不再互相串扰，旧版仅按 `orderId` 的匿名本地快照在首次命中时也会自动迁移到当前登录用户，而长期未被认领的匿名残留会在 24 小时内优先清理，已认领的用户级缓存仍维持 7 天保留窗口；此外 App 现在只会在首次进入 PetPal 页面壳时懒触发一次缓存 warmup，不再由全局 `main.ts` 无差别拉起消息状态模块
- PetPal App 独立投诉页当前也已把本地证据状态从 URL 字符串数组升级为受管附件快照列表，预览 / 移除都按 `fileId` 处理，但提交给后端时仍沿用当前 `evidenceUrls` 契约
- PetPal 投诉附件的本地快照结构和前端上传限额当前已收口到 `@rbac/api-common`，Web / App 投诉页不再各自手写 `petpal-order-complaint` 标签和 3 张 / 8 MB 约束
- PetPal 订单消息附件与照料者资质附件的前端上传标签 / 限额当前也已收口到 `@rbac/api-common`；App 资质页还会按剩余名额限制上传，避免超过 12 份后再静默截断
- PetPal Web 照料者资料页当前也已切到受管资质附件上传，不再手填材料名称和 URL；历史上已保存的手填链接记录仍会继续显示并可查看 / 移除

## 5. 关键架构原则

### 5.1 后端定义，前端消费

以下内容应继续以后端为事实来源：

- 菜单树
- 页面/动作权限绑定
- 认证策略开关
- 客户端身份校验

前端主要负责：

- 读取配置
- 渲染对应 UI
- 在展示层裁剪无权限操作

### 5.2 公共前台与控制台必须分离

- `/` 命名空间用于介绍项目、承接外部访问和信任建立。
- `/console` 命名空间用于后台业务操作。
- 不要让控制台壳子重新吞掉公共前台入口。

### 5.3 页面组件只做编排

对 Web 管理页，默认规范是：

- 页面组件负责 orchestration
- 搜索表单、表格、详情、编辑弹窗、右键菜单等拆到 `components`
- 共享体验问题优先在全局样式、共享组件、布局层修复

### 5.4 展示层权限不是最终裁决

- `v-permission` / `v-role` 只负责隐藏按钮与操作入口
- 后端 RBAC 才是最终权限裁决

### 5.5 OAuth 授权页与裁决边界

- OAuth 授权确认页与错误页可以放在 Web 前端承载，但前端只负责展示与交互，不负责安全裁决。
- 当前登录用户身份必须由后端会话/令牌识别，不依赖前端 store 或 localStorage 的登录态。
- OAuth 授权最终结果（是否允许、重定向目标）必须由后端返回，前端不能自行拼接或决定 redirect。
- 授权会话的所属用户校验必须在后端完成，避免跨账号串用 `session_state`。
- 前端 OAuth 页面应通过后端 API 拉取授权会话详情并提交 `approve/deny`，后端再返回最终 `redirectUrl`。

### 5.5 文档需要同步维护

发生架构变化时，至少同步更新：

- `README.md`
- `docs/project-memory.md`
- `docs/development-guidelines.md`

## 6. 默认端口与入口

- backend：`3300`
- web：默认 `5173`
- public frontend：`/`
- login：`/login`
- console：`/console`

不要单独修改某一端口而不同时更新依赖它的环境变量和文档。

## 7. 优先查看的文件

继续开发前，先看：

1. `README.md`
2. `docs/README.md`
3. `docs/project-memory.md`
4. `docs/development-guidelines.md`
5. `docs/implementation-history.md`

关键实现锚点：

- backend 启动入口：`apps/backend/src/main.ts`
- backend timers：`apps/backend/src/timers/index.ts`
- Prisma 扩展：`apps/backend/src/lib/prisma.ts`
- 认证策略：`apps/backend/src/services/auth-strategies.ts`
- auth routes：`apps/backend/src/routes/auth.ts`
- web router：`apps/web-frontend/src/router/index.ts`
- access directives：`apps/web-frontend/src/directives/access.ts`
- frontend 内容：`apps/web-frontend/src/pages/frontend`
- console 页面：`apps/web-frontend/src/pages/console`

## 8. 验证方式

- Backend：
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend test`
  - `pnpm --filter @rbac/backend build`
- Shared API：
  - `pnpm --filter @rbac/api-common lint`
  - `pnpm --filter @rbac/api-common build`
- Web：
  - `pnpm --filter @rbac/web-frontend lint`
  - `pnpm --filter @rbac/web-frontend build`
- App：
  - `pnpm --filter @rbac/app-frontend type-check`

## 9. 不可退化的约束

- RBAC 必须保持真实数据库驱动
- App 必须保持 unibest 结构
- 控制台路由必须继续聚合在 `/console/**`
- 菜单树继续作为控制台导航事实来源
- 认证接口必须继续校验 client 身份
- 认证流程继续由 strategy 模式承载
- 核心实体继续维持审计字段 + 软删除 + 雪花 ID
- 后台定时任务继续收敛到 backend timers
- Web 页面继续遵守“页面编排 + 目录内 components 拆分”的规范
