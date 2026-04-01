# Archive 01: Foundation And RBAC

Covered sections: 1-13

## Scope

本卷记录项目从通用工程底座到可承载业务系统的第一阶段演进。

## Main Outcomes

- 建立 `pnpm workspace` monorepo，明确 `backend`、`web-frontend`、`app-frontend` 与 `api-common` 的边界。
- 完成 RBAC 基础域：用户、角色、权限、关系绑定、权限来源分析、审计日志与 dashboard 汇总。
- 认证体系从单一路径升级到 `Client + Strategy` 模型，支持用户名密码、邮箱验证码、手机验证码与 mock 联调。
- ORM 层统一审计字段、软删除与雪花 ID，减少实体侧重复实现。
- 上传链路升级为对象存储直传 + 补偿处理，定时任务收口进 backend timers。
- 控制台菜单树、路由注入、页面规范、右键菜单与前端展示层权限裁剪全部成型。
- 登录页、公共前台和系统介绍页完成首轮视觉升级。
- OAuth 授权确认页迁移到 Web 前端，backend 收口为协议处理和 API 提供者。

## Resulting Baseline

- 项目已经不再是单纯的 RBAC 示例，而是具备真实业务扩展基础的工程底座。
- 这一阶段为后续 PetPal 业务迁移提供了共享接口契约、权限体系、上传能力和多端页面组织规范。
