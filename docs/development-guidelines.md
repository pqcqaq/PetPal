# Development Guidelines

Last updated: 2026-04-01

这些规则代表当前仓库默认遵循的开发方式。除非有明确架构理由，否则新改动应优先收敛到这些约束之内，而不是重新发明一套局部模式。

## 1. Monorepo 边界

- 保持工作区边界清晰：
  - `apps/backend`
  - `apps/web-frontend`
  - `apps/app-frontend`
  - `packages/api-common`
- `packages/api-common` 是跨端共享请求和类型的边界。共享 DTO、Header、API 工厂变化后，先构建它，再验证依赖方。
- `apps/app-frontend` 必须继续遵守官方 unibest 结构，不要把它重写成自定义 uni-app 工程架构。
- 能抽到共享层的重复逻辑，优先放到：
  - backend service / utility
  - shared API factory
  - frontend composable / store / shared component

## 2. Backend 规则

- RBAC 必须保持真实、数据库驱动，不能退回到 mock 权限判断。
- 路由处理器应尽量薄，业务装配下沉到 `services`、`utils` 或 `timers`。
- 新定时任务统一注册在 `apps/backend/src/timers`，通过共享 timer 抽象接入，不要再引入新的独立 worker 进程。
- 上传能力继续以 S3 兼容模型为抽象边界；如需兼容 OSS/COS/MinIO，应通过同一套 S3 能力接入。
- 鉴权链路默认分为两层：
  - client 级别校验
  - strategy 级别认证
- 新认证能力优先扩展：
  - `AuthStrategy`
  - `UserAuthentication`
  - `VerificationCode`
  - 对应 strategy handler

## 3. 数据层与 ORM 规则

- 受审计管理的核心实体必须保持以下字段语义统一：
  - `id`
  - `createId`
  - `updateId`
  - `createdAt`
  - `updatedAt`
  - `deleteAt`
- 主键默认使用雪花算法生成，不要在业务代码里重新引入自增主键思路。
- 删除行为默认是逻辑删除，优先通过 Prisma 扩展统一处理，不要在各个 route 里散落自定义软删除逻辑。
- 查询默认过滤 `deleteAt != null` 的记录，除非确实需要恢复/审计语义且有明确理由。

## 4. 认证与安全规则

- 所有认证相关接口默认需要系统级 client 凭据。
- 前端项目应通过环境变量注入 client code 与 secret，而不是在业务代码里硬编码。
- token 需要保留 client 来源语义，避免不同客户端之间刷新链路混淆。
- 验证码类能力通过策略层实现，发送、校验、消费逻辑不要写死在 route 内。
- mock 能力属于策略配置的一部分，不属于页面层临时分支逻辑。

### 4.1 OAuth 授权页安全边界

- OAuth 授权页可以由前端实现，但“授权是否成立”必须由后端判定。
- 前端登录态（Pinia/localStorage）只能用于页面体验，不能作为授权决策依据。
- 授权会话详情和授权决策必须通过后端 API 获取和提交。
- 后端必须校验授权会话与当前用户绑定关系，拒绝跨用户复用 `session_state`。
- 前端拿到后端返回的 `redirectUrl` 后再跳转，不在前端自行计算 OAuth 回跳地址。

## 5. Web 路由与页面组织规则

- Web 前端保持双命名空间：
  - `pages/frontend`：访客可访问的介绍页
  - `pages/console`：控制台业务页
- `/console/**` 是所有后台业务页面的统一命名空间。
- 公共前台通过布局层统一处理 Header / Footer，不在各个页面重复拼装。
- 新页面必须放在正确的命名空间下，并在其目录中建立 `components` 子目录拆分细节组件。
- 页面组件本身只负责 orchestration：
  - 状态编排
  - 组合子组件
  - 页面级接口调用
- 搜索表单、列表、详情、编辑弹窗等细节优先抽到页面目录下的 `components`。

## 6. 菜单、权限与展示层规则

- 后端菜单树是控制台导航的事实来源：
  - 层级
  - 顺序
  - 图标
  - 路径
  - 页面/动作权限绑定
- 页面元信息使用 `definePage(...)` 维护页面级描述，不要重新引入分散的页面 JSON 作为主导航来源。
- 前端展示层权限裁剪统一使用：
  - `v-permission`
  - `v-role`
- 指令支持 `and/or` 运算语义。展示层不通过时直接隐藏按钮，但后端鉴权仍然是最终裁决。
- 右键菜单能力优先复用共享抽象，不在具体页面重复造轮子。

## 7. UI 与体验规则

- 控制台界面优先追求紧凑、专业、可连续操作的空间密度，避免大片无效留白。
- 共享表单间距应保持一致，优先通过全局样式或共享组件调整，而不是逐页手工覆盖。
- Header、Sidebar、Tabs、PageScaffold 要作为统一工作台体验来维护，不要割裂成多个悬浮区块。
- 登录页、公共前台等对外页面应保持正式、可展示、可截图的视觉质量，不能只满足“能用”。
- App 端以 Material Design 3 为默认设计方向，要求具备清晰的 surface、elevation、状态色、组件层级和有意义的过渡动画。
- Web 与 App 的用户操作页面禁止继续向“超级页面”扩张；主人、照料者、售后、消息、设置等逻辑必须按角色和场景拆页。
- 一个页面只保留一个主任务，长流程优先拆为分步式、标签页或子页面，不在单页上并排堆叠全部表单和全部动作。
- 订单详情类页面默认拆分为概览、沟通、服务记录、售后等子视图；列表页负责检索与进入详情，不承担完整编辑职责。
- 关键 UX 元素必须统一设计：
  - 主按钮层级
  - 返回路径
  - 加载态 / 空态 / 错误态 / 禁用态
  - 上传进度
  - 危险动作二次确认
- 聚合型工作台或中心页必须同时提供页面级兜底和区块级恢复；单个区块失败时优先局部降级和局部重试，不把整页刷新作为唯一恢复路径。
- App 端交互必须优先保证单手操作、底部安全区域可达性和弱网恢复体验，动画只用于引导理解，不得妨碍核心操作。

## 8. 文档规则

- 发生架构或能力变化时，至少同步更新：
  - `README.md`
  - `docs/project-memory.md`
  - `docs/development-guidelines.md`
- 发生 Web / App 体验架构重构时，同步更新：
  - `apps/docs/project/PetPal.md`
  - `apps/docs/project/PetPal-UX-Rebuild.md`
- 发生阶段性重构时，更新 `docs/implementation-history.md`；如果日志已经过长，拆分到 `archives/development-logs/*.md`。
- `docs/plans/*.md` 是历史设计快照，不应被重写为当前事实说明；如需提醒，只增加说明，不改写其历史语义。

## 9. TypeScript 与代码质量规则

- 不使用 `any`。
- 优先使用共享类型或明确的本地领域类型，不依赖隐式对象结构。
- 小步重构优先于大面积无边界改写。
- 如果一个模式已经在两个地方出现，优先考虑抽象，而不是复制第三次。

## 10. 验证规则

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

改动哪个包，就至少运行与该包对应的验证命令。只改文档时可以不跑全量构建，但提交前仍要审查内容是否与真实代码一致。
