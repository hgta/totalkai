## ADDED Requirements

### Requirement: 内容公共基表结构与唯一 slug

系统 SHALL 提供 `content_items` 公共基表，包含 `id`、`type`、`slug`、`title`、`status`、`created_at`、`updated_at`、`published_at` 字段，并对 `slug` 施加唯一约束。

#### Scenario: 插入重复 slug

- **WHEN** 写入一条 slug 与既有记录相同的 `content_items` 记录
- **THEN** 写入失败并返回唯一约束冲突错误

#### Scenario: 按类型与状态查询

- **WHEN** 按 `type` 与 `status` 组合查询内容
- **THEN** 查询命中 `(type, status)` 复合索引并返回匹配记录

### Requirement: 发布状态机与合法流转

系统 SHALL 维护 `draft`、`in-review`、`published` 三态，仅允许 `draft→in-review`、`in-review→published`、`in-review→draft`、`published→draft` 四种流转。

#### Scenario: 执行合法流转

- **WHEN** 将一条 `draft` 记录提交为 `in-review`
- **THEN** 状态变更为 `in-review` 且 `updated_at` 被更新

#### Scenario: 执行非法流转

- **WHEN** 尝试将一条 `draft` 记录直接变更为 `published`
- **THEN** 系统抛出错误且记录状态保持不变

### Requirement: 前台查询仅返回已发布内容

系统 SHALL 保证所有前台数据访问仅返回 `status` 为 `published` 的记录。

#### Scenario: 前台查询时存在草稿

- **WHEN** 数据库中同时存在 `draft` 与 `published` 记录且执行前台列表查询
- **THEN** 查询结果仅包含 `published` 记录

#### Scenario: 直接访问未发布内容的 URL

- **WHEN** 访客直接访问一条 `draft` 记录对应的详情 URL
- **THEN** 系统返回 404，不展示该内容

### Requirement: 数据库迁移可重复执行

系统 SHALL 提供可重复执行的迁移命令，已应用过的迁移不得重复执行。

#### Scenario: 连续两次执行迁移

- **WHEN** 在同一数据库上连续执行两次迁移命令
- **THEN** 第二次执行不产生结构变更且不报错

### Requirement: 环境变量缺失时启动失败

系统 SHALL 在启动时校验必需环境变量，缺失时立即失败并输出指明缺失变量的错误。

#### Scenario: 缺少 DATABASE_PATH 时启动应用

- **WHEN** 在未设置 `DATABASE_PATH` 的情况下启动应用
- **THEN** 应用启动失败并输出指明该变量缺失的错误信息
