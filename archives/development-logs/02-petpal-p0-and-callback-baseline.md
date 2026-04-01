# Archive 02: PetPal P0 And Callback Baseline

Covered sections: 14-25

## Scope

本卷记录 PetPal 首轮业务落地，以及支付回调接入、审计与可视化的 P0 基线建设。

## Main Outcomes

- `api-common` 建立 PetPal 共享契约与 API factory 端点。
- Web 前台新增 `/petpal`，支持宠物档案、需求发布、订单总览和照料者匹配的最小闭环。
- Uni 端新增 `pages/petpal/index`，形成双端基础入口。
- 双端订单详情页上线，统一展示订单基础信息、支付时间线和退款时间线。
- 后端抽出 `petpal-callback-auth`，为支付/退款回调提供统一鉴权适配层。
- WeChat Pay 回调验签路径补齐原始请求体、SDK/HMAC provider 切换和失败路径测试。
- 回调鉴权结果开始结构化输出，并逐步落地为可查询的回调审计数据。
- 管理端补齐回调审计查询 API、Web 查询 UI、统计与导出。
- P0 收尾阶段已经完成基础 lint、类型检查和 PetPal 集成测试校验。

## Resulting Baseline

- PetPal 从“产品设想”进入“真实可点开、可查询、可审计”的初始状态。
- 回调链路、订单详情和管理端审计能力为后续治理增强提供了可持续扩展的起点。
