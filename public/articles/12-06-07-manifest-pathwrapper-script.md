---
title: "manifest path 不能带参数，所以先造 wrapper script，说明接入链也要替宿主生态转译"
slug: "12-06-07-manifest-pathwrapper-script"
date: 2026-04-09
topics: [外延执行]
summary: "浏览器的 native host manifest 有自己的死规矩：`path` 里不能带参数。Claude Code 没拿这个限制硬碰硬，而是老老实实先造一个 wrapper script，再让 m..."
importance: 1
---

# manifest path 不能带参数，所以先造 wrapper script，说明接入链也要替宿主生态转译

浏览器的 native host manifest 有自己的死规矩：`path` 里不能带参数。Claude Code 没拿这个限制硬碰硬，而是老老实实先造一个 wrapper script，再让 manifest 去指向这个脚本。这样浏览器继续活在它自己的规则里，Claude Code 也还能把真正需要的参数带上。

这就是很典型的宿主生态翻译。成熟工程不会要求外部世界为自己改规则，而是自己在接缝处多做一层转换，把两边都伺候明白。

## 实现链
`createWrapperScript()` 的注释已经写明：Chrome native host manifest 的 `path` 不能带参数，所以必须先在 `~/.claude/chrome/` 生成一个 wrapper，再让 wrapper 去调用真正的 `claude --chrome-native-host`。这是一层为宿主生态补的翻译。

## 普通做法
普通想法是直接把 `--chrome-native-host` 参数写进 manifest。

## 为什么不用
Claude Code 不这么写，因为协议本身就不允许。它只能接受“多一层脚本”这种现实解。

## 代价
代价是磁盘上会多一个持久脚本文件，而且还要分别处理 Unix 和 Windows 两种脚本内容。

