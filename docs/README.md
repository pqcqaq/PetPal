# Documentation Guide

本目录用于保存“当前真实状态”和“文档入口说明”。详细的开发日志不再长期堆放在 `docs/` 目录，而是统一归档到仓库根目录的 `archives/development-logs/`。

## 建议阅读顺序

1. `../README.md`
2. `project-memory.md`
3. `development-guidelines.md`
4. `implementation-history.md`
5. `../archives/development-logs/README.md`
6. `plans/*.md`

## 文档角色划分

### `../README.md`

面向仓库访问者与潜在使用者，回答这些问题：

- 这个项目是什么
- 它解决什么问题
- 有哪些亮点
- 如何启动
- 如何快速判断是否值得使用

### `project-memory.md`

面向继续开发这个仓库的人，记录当前事实状态：

- 当前边界
- 已落地架构
- 关键设计决定
- 默认约束
- 继续开发时不能随意破坏的规则

### `development-guidelines.md`

面向日常编码与重构，记录默认规范：

- 目录和边界如何保持
- 后端、前端、数据层各自的默认实现规则
- 页面、组件、路由、权限、文档如何组织
- 每次改动后应该做哪些验证

### `implementation-history.md`

面向快速恢复上下文，保留“当前开发总览”和“归档索引”。它不再承担全部逐切片日志的存放职责。

### `../archives/development-logs/*.md`

面向需要追溯历史演进细节的人，按阶段归档详细开发日志。大体积实现历史应继续写入这里，而不是重新堆回 `docs/` 目录。

### `plans/*.md`

这些文件是历史性的设计快照，保留当时的思考过程和任务拆分，不应被误读为当前唯一事实来源。当前真实状态始终以代码、`project-memory.md`、`development-guidelines.md` 和 `implementation-history.md` 为准。

## 文档更新原则

- 发生架构变化时，至少同步更新：
  - `../README.md`
  - `project-memory.md`
  - `development-guidelines.md`
- 发生重要阶段性重构时，更新：
  - `implementation-history.md`
- 若阶段日志过长，拆分归档到：
  - `../archives/development-logs/*.md`
- 历史计划文档默认保留，不要把它们重写成当前状态说明；必要时只增加“历史快照”说明。

## 截图与演示素材

当前 README 中使用的是文字占位符。后续如果补充正式截图，建议统一放到：

- `docs/assets/`

推荐素材：

- 公共前台首页
- 登录页
- PetPal 主人服务台
- PetPal 后台总览
- 投诉工单治理页
- 照料者审核页
- Uni 客户端页面

## 维护目标

这套文档的目标不是“写得多”，而是让任何接手此仓库的人在较短时间内回答下面这些问题：

- 这个项目当前到底实现到了哪一步
- 哪些能力是稳定边界
- 哪些文件是继续开发时最先要看的
- 哪些历史信息是背景，哪些才是当前真相
