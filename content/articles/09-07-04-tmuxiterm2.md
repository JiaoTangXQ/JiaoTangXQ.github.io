---
title: "先判 tmux 还是 iTerm2 再缓存结果，说明团队空间先要稳定可解释"
slug: "09-07-04-tmuxiterm2"
date: 2026-04-09
topics: [多Agent协作]
summary: "团队空间一旦开始生成，Claude Code 就希望整个会话都讲同一种空间语言。 `registry.ts` 的 `detectAndGetBackend()` 会在首次探测后把结果缓存到 `cach..."
importance: 1
---

# 先判 tmux 还是 iTerm2 再缓存结果，说明团队空间先要稳定可解释

团队空间一旦开始生成，Claude Code 就希望整个会话都讲同一种空间语言。

## 实现链

`registry.ts` 的 `detectAndGetBackend()` 会在首次探测后把结果缓存到 `cachedDetectionResult`。优先级也很明确：先看 tmux，再看 iTerm2，再看外部 tmux。后续再创建 teammate pane 时直接复用这个结果。

## 普通做法

普通做法可能每次 spawn 时重新探测环境，谁当前可用就用谁。

## 为什么不用

Claude Code 不这么做，是因为团队空间比瞬时最优更需要稳定。如果今天第一个 teammate 在 tmux，第二个忽然跑到 iTerm2，用户的团队心智模型会直接裂开。

## 代价

代价是会话中途环境变好也不会自动切换，系统宁可保守，也要维持可解释性。
