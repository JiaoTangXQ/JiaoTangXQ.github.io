---
title: "选中文本时提示切换成 copy 和 native select，说明界面承认自己不垄断选择动作"
slug: "11-05-08-copynative-select"
date: 2026-04-09
topics: [终端界面]
summary: "一旦用户进入选择状态，底部区会主动把提示切成 `copy` 和 `native select`，而且在 `xterm.js`、`macOS` 这类环境里还会改成更具体的操作说明。说明这套界面知道：有些..."
importance: 1
---

# 选中文本时提示切换成 copy 和 native select，说明界面承认自己不垄断选择动作

一旦用户进入选择状态，底部区会主动把提示切成 `copy` 和 `native select`，而且在 `xterm.js`、`macOS` 这类环境里还会改成更具体的操作说明。说明这套界面知道：有些动作不是它独占的，终端和宿主环境也在参与。

好的应用不是假装自己拥有全部输入权，而是老老实实把边界讲清楚。

## 实现链

`PromptInputFooterLeftSide.tsx` 会根据 `hasSelection`、`copyOnSelect` 和 `isXtermJs()` 动态决定底部是显示 `ctrl+c copy`、`native-select`，还是干脆不提示。界面承认文本选择有时靠自己处理，有时靠终端原生能力处理。

## 普通做法

更普通的实现会永远写一条固定复制提示，或者完全不提，让用户自己猜当前该按哪组键。

## 为什么不用

Claude Code 不把复制动作写成统一口号，是因为不同终端和配置下，真正有效的选择路径并不一样。提示要服从现场，而不是反过来要求现场配合提示。

## 代价

代价是底部逻辑必须知道更多宿主环境信息，条件判断更多；但至少它说的是当前环境里真的可用的动作。
