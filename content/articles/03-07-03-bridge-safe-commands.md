---
title: "BRIDGE_SAFE_COMMANDS 为什么不是同一件事的重复"
slug: "03-07-03-bridge-safe-commands"
date: 2026-04-09
topics: [输入与路由]
summary: "很多人第一次看到 `BRIDGE_SAFE_COMMANDS`，会以为它只是 `REMOTE_SAFE_COMMANDS` 的另一份名单。其实两者处理的根本不是同一个问题。`REMOTE_SAFE_C..."
importance: 1
---

# BRIDGE_SAFE_COMMANDS 为什么不是同一件事的重复

很多人第一次看到 `BRIDGE_SAFE_COMMANDS`，会以为它只是 `REMOTE_SAFE_COMMANDS` 的另一份名单。其实两者处理的根本不是同一个问题。`REMOTE_SAFE_COMMANDS` 关心的是“远端 REPL 里该出现哪些命令”；`BRIDGE_SAFE_COMMANDS` 关心的则是“当输入是从手机或网页桥接进来的，这条命令能不能被安全触发”。

所以 bridge 的标准更细。源码里它不是简单列一张白名单完事，而是先按命令类型分层: `prompt` 命令默认安全，因为它们本质上只是展开成文本并继续交给模型；`local-jsx` 一律拦下，因为它们要拉本地 Ink 界面；只有 `local` 命令才需要再进 `BRIDGE_SAFE_COMMANDS` 这张显式允许表。换句话说，bridge 不是在问“远端能不能看见它”，而是在问“桥另一头发来的这次触发，是否会逼本地突然做出不合适的 UI 或副作用动作”。

这就是为什么它不是重复，而是另一层更贴近入口来源的安全边界。Claude Code 在这里非常老练: 同样叫远离本地的世界，remote 和 bridge 其实是两种不同物理情境，所以就该有两套不同判断。把这两件事分开，才不会把“会话在哪里”与“输入从哪里来”混成一团。

## 实现链
`BRIDGE_SAFE_COMMANDS` 不是简单复制 `REMOTE_SAFE_COMMANDS`，它更严格，尤其会拦住 `local-jsx` 这类需要本地终端 UI 的命令。`processUserInput()` 还会用 `bridgeOrigin` 和 `isBridgeSafeCommand()` 提前决定能不能放行。

## 普通做法
最省事的做法是把“远端安全”和“bridge 安全”合并成同一张白名单。

## 为什么不用
因为 bridge 客户端面对的是更受限的环境，尤其移动端和远控客户端不具备本地终端 UI。远端能做，不代表 bridge 客户端也能做。

## 代价
安全边界会多出一层，看起来像重复规则；但它们解决的其实是两个不同入口的真实约束。
