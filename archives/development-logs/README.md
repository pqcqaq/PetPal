# Development Log Archive

Last updated: 2026-04-01

这里存放从 `docs/implementation-history.md` 拆分出来的开发日志归档。`docs/` 目录现在只保留当前状态总览，详细历史按阶段单独归档在这里，便于检索和后续继续追加。

## Archive Files

- [01. Foundation And RBAC](./01-foundation-and-rbac.md)
  - 覆盖原始章节 1-13。
  - 包含 monorepo、RBAC、认证、上传、菜单、控制台与 OAuth 前端迁移基线。
- [02. PetPal P0 And Callback Baseline](./02-petpal-p0-and-callback-baseline.md)
  - 覆盖原始章节 14-25。
  - 包含 PetPal P0 前台、订单详情、支付/退款时间线、回调鉴权与回调审计首轮落地。
- [03. Callback Governance Expansion](./03-petpal-callback-governance.md)
  - 覆盖原始章节 26-48。
  - 包含回调审计治理、保留清理、告警 outbox、死信重放、replay log 与风险信号。
- [04. PetPal Business Loop Buildout](./04-petpal-business-loop.md)
  - 覆盖原始章节 49-72。
  - 包含照料者入驻、履约、服务日志、评价、投诉、退款进度与售后时间线。
- [05. Export Enhancements And Productization](./05-petpal-export-and-productization.md)
  - 覆盖原始章节 73-87。
  - 包含退款导出增强、根级后台直达、Web/App 产品语义收口与资料页重构。
- [06. Root Admin, App Rebuild And Messaging](./06-petpal-admin-app-and-messaging.md)
  - 覆盖原始章节 88-104。
  - 包含根级后台接管、默认落点统一、App 双工作台、健康档案、资质材料与订单消息闭环。

## Maintenance Rule

- `docs/implementation-history.md` 只保留阶段总览和归档索引。
- 新的长日志不要再直接堆进 `docs/` 目录。
- 后续按阶段新增 `NN-*.md` 归档文件，并在此处补充索引。
