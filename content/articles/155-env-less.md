---
title: "第十三卷回收索引：远端边界世界里 env-less 拿掉的是一层世界，不是几步手续"
slug: "155-env-less"
date: 2026-04-09
topics: [参考]
summary: "这页具体回收的判断是“远端边界世界—env—less拿掉的是一层世界不是几步手续”。 这页真正回收的是 bridge、remote session、permission bridge、teleport..."
importance: 0.9
---

# 第十三卷回收索引：远端边界世界里 env-less 拿掉的是一层世界，不是几步手续

## 实现链

这页具体回收的判断是“远端边界世界—env—less拿掉的是一层世界不是几步手续”。
这页真正回收的是 bridge、remote session、permission bridge、teleport、assistant 和 reconnect 逻辑。`RemoteSessionManager`、`SessionsWebSocket`、`remotePermissionBridge.ts`、`main.tsx` 里的 teleport/remote 分流都在说明：远端世界不是把本地终端简单拉长，而是先把边界、风险、消息翻译和断线恢复重新算一遍。

## 普通做法

更常见的远端实现，是做透明代理：本地和远端尽量长得一样，用户最好感觉不到边界。这样心智负担最小，工程上也像是在“把连接打通”。

## 为什么不用

Claude Code 没这么处理，是因为一旦跨边界，权限谁裁、消息怎么翻、连接断了怎么办、哪些东西绝不能被带上路，都会立刻变成新问题。假装边界不存在，只会让错误和风险被推迟到更难收拾的时候。

## 代价

现在这套做法更诚实，能把跨边界后的真实风险说清楚。代价是桥接层、翻译层和重连层都更厚，读者也必须接受“远端不是本地副本，而是另一层现实”这个更难的心智模型。

## 继续下钻

- `08-03-02` 把 `env-less` 写成把不该绑在 REPL 身上的一整层环境世界切出去，这会在 `13-02-01` 里回收到“层级秩序首先体现在敢把不该同住的东西拆开”，说明系统不是优化一条路径，而是先把一整层不必要的世界移出运行核心。
