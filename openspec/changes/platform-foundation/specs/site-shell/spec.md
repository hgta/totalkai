## ADDED Requirements

### Requirement: 站点提供全局布局与导航

系统 SHALL 为所有页面提供统一的根布局，包含页头主导航与页脚，并在小屏幕视口下提供可用的移动端导航。

#### Scenario: 桌面端访问任意页面

- **WHEN** 访客在桌面视口访问站点任意页面
- **THEN** 页面渲染统一页头（含主导航）与页脚

#### Scenario: 移动端展开导航

- **WHEN** 访客在移动视口点击导航触发按钮
- **THEN** 导航菜单展开且其中链接可点击

### Requirement: 首页展示站点定位

系统 SHALL 在首页展示站点定位说明与评测罗盘预告区，明确本站为「中文 AI 购物助手评测知识与评测内容平台」。

#### Scenario: 访客首次访问首页

- **WHEN** 访客访问站点根路径
- **THEN** 页面展示站点定位说明与评测罗盘预告区

### Requirement: 未知路径返回 404

系统 SHALL 对不存在的路径返回 404 状态码并渲染 404 页面。

#### Scenario: 访问不存在的路径

- **WHEN** 访客访问 `/no-such-page`
- **THEN** 系统返回 HTTP 404 并渲染 404 页面

### Requirement: 全站提供默认元信息与 OG 图

系统 SHALL 为所有页面设置默认 title、description 与 OG 图，且允许页面覆盖这些值。

#### Scenario: 页面未显式声明 Metadata

- **WHEN** 某页面未声明自身 Metadata
- **THEN** 页面仍输出站点级默认 title、description 与 OG 图

### Requirement: 内容为空时展示空态而非报错

系统 SHALL 在任意内容列表为空时渲染空态提示，不得抛出异常或渲染空白页。

#### Scenario: 数据表为空时访问首页

- **WHEN** 数据库中无任何内容记录时访客访问首页
- **THEN** 页面正常渲染并展示空态提示，且 HTTP 状态码为 200
