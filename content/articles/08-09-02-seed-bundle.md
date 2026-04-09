---
title: "环境选择和-seed-bundle-说明它在搬整块工作现场"
slug: "08-09-02-seed-bundle"
date: 2026-04-09
topics: [远端与边界]
summary: "- `environmentSelection.ts` 会从 merged settings 和各层设置源里找 `defaultEnvironmentId`，决定这次会话落在哪个环境；`gitBund..."
importance: 1
---

# 环境选择和-seed-bundle-说明它在搬整块工作现场

## 实现链
- `environmentSelection.ts` 会从 merged settings 和各层设置源里找 `defaultEnvironmentId`，决定这次会话落在哪个环境；`gitBundle.ts` 则通过 `stash create -> refs/seed/stash -> git bundle -> upload`，必要时再从 `--all` 回退到 `HEAD` 和 squashed-root。
- 这两条链放在一起看，很清楚：teleport 搬的不是一条指令，而是“在哪个环境里，以什么仓库快照开这次工作现场”。

## 普通做法
- 普通做法要么直接 `git clone` 一个仓库，要么用 rsync/压缩包把当前目录传上去，环境则靠一个固定远端主机。
- 这些办法都更容易想到。

## 为什么不用
- Claude Code 没只用简单 clone 或简单远端终端，是因为它既要尊重组织环境选择，又要尽量把当前工作副本，包括已跟踪但未提交的 WIP，一起带过去。
- 所以它宁可做 seed bundle 和多级回退，也不把远端现场简化成“远端自己想办法拿代码”。

## 代价
- 代价是 bundle 逻辑很重，而且 untracked 文件仍然抓不住，大仓库还要经历 `--all -> HEAD -> squashed` 的降级。
- 这不算完美，但从代码看，它是在努力搬整块工作现场，而不是只开一台空远端壳子。
