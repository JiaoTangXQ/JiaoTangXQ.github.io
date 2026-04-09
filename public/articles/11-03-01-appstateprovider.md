---
title: "AppStateProvider 故意做薄，说明复杂度被压进了状态系统"
slug: "11-03-01-appstateprovider"
date: 2026-04-09
topics: [终端界面]
summary: "`AppStateProvider` 本身很薄，这不是简单，而是克制。它只负责把 store 建起来、接上设置变化、包好少数 provider，然后就把复杂度交给状态系统和选择器订阅。 这种做法很成熟..."
importance: 1
---

# AppStateProvider 故意做薄，说明复杂度被压进了状态系统

`AppStateProvider` 本身很薄，这不是简单，而是克制。它只负责把 store 建起来、接上设置变化、包好少数 provider，然后就把复杂度交给状态系统和选择器订阅。

这种做法很成熟。真正大的终端应用，不会把根组件写成一锅粥，而是把入口做成几层稳定底座，让复杂行为在状态世界里有秩序地长。

## 实现链

`AppStateProvider` 真正做的事很少：防嵌套、创建一次 store、挂载时做一次绕权修正、监听外部 settings 变化，然后把 store 放进 context。复杂度没有堆在 provider 里，而是被压进 store、selector 和副作用总闸门。

## 普通做法

更直觉的 provider 很容易越写越胖：既管创建状态，又管业务副作用，还顺手处理一堆派生逻辑。

## 为什么不用

Claude Code 不让 provider 长胖，是因为 provider 一旦承担太多责任，订阅边界和写入入口就会重新糊掉。它宁可让 provider 看起来有点“空”，也不想让这里再变成第二个 orchestrator。

## 代价

代价是很多真正关键的逻辑都不在 provider 文件正中央，新读者得跳转更多文件；但边界因此更干净。
