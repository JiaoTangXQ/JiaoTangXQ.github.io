---
title: "第十三卷回收索引：外延执行里自动启用与 reconnect 页是产品接入链留下的形状"
slug: "126-reconnect"
date: 2026-04-09
topics: [参考]
summary: "这页具体回收的判断是“外延执行—自动启用与reconnect页是产品接入链留下的形状”。 这页真正回收的是 computer use、Claude in Chrome、Native Host、mani..."
importance: 0.9
---

# 第十三卷回收索引：外延执行里自动启用与 reconnect 页是产品接入链留下的形状

## 实现链

这页具体回收的判断是“外延执行—自动启用与reconnect页是产品接入链留下的形状”。
这页真正回收的是 computer use、Claude in Chrome、Native Host、manifest、`request_access`、重连和命名层这一整条真实世界接入链。代码努力把这些强能力重新翻译回 MCP 风格、权限上下文和原有工具命名，让它们看起来像工作台的自然外延，而不是第二套平行运行时。

## 普通做法

更容易想到的做法，是给浏览器和设备操作单独造一套协议、单独做一层产品 UI、再在旁边挂一套专用权限。那样更直给，功能展示也更强。

## 为什么不用

Claude Code 没这样干，是因为强能力一旦另起炉灶，最先崩的不是 demo 效果，而是制度一致性。它宁愿在命名、接入链和桥接层上多费功夫，也要保证这些外延能力继续服从原来的权限、工具语言和恢复逻辑。

## 代价

这样做的好处是不会轻易长出第二运行时，能力边界仍由主系统裁决。代价是桥接层、装配差异、manifest 管理和 reconnect 细节明显更绕，看起来没有“直接调用专用 API”那么爽快。

## 继续下钻

- `Native Host`、`manifest`、目录、注册表和检测一起怎样长出笨重但必要的接入底座
- 自动启用、缓存检测和 `reconnect` 页怎样把失败与重接也纳入设计
### 接入底座先长成笨重但必要的形状
- [195-第十三卷回收索引-外延执行-Native-Host-manifest-目录与注册表一起说明产品接入链本来就会长出笨重底座.md](/Users/xxx/tmp/cc/docs/claude-code-book/appendices/195-第十三卷回收索引-外延执行-Native-Host-manifest-目录与注册表一起说明产品接入链本来就会长出笨重底座.md)
### 自动启用、缓存检测和 `reconnect` 页把失败与重接一起设计进去
- [196-第十三卷回收索引-外延执行-自动启用缓存检测与reconnect页说明失败与重接也要一起被设计进去.md](/Users/xxx/tmp/cc/docs/claude-code-book/appendices/196-第十三卷回收索引-外延执行-自动启用缓存检测与reconnect页说明失败与重接也要一起被设计进去.md)
