---
title: "Windows 先集中 manifest 落点再用各浏览器 registry 分发，说明碎生态要先集中收口"
slug: "12-06-10-windowsmanifestregistry"
date: 2026-04-09
topics: [外延执行]
summary: "在 Windows 上，Claude Code 没有给每个浏览器各造一套 manifest 落点，而是先放到一个公共位置，再通过不同浏览器的 registry key 把这条线分发出去。这种做法很像先..."
importance: 1
---

# Windows 先集中 manifest 落点再用各浏览器 registry 分发，说明碎生态要先集中收口

在 Windows 上，Claude Code 没有给每个浏览器各造一套 manifest 落点，而是先放到一个公共位置，再通过不同浏览器的 registry key 把这条线分发出去。这种做法很像先修一座总配电箱，再从里面分路。

面对碎裂生态时，先集中收口再分发，通常比各自为政更稳。因为真正麻烦的不是写出一份 manifest，而是让它在一堆宿主礼法里还能长期维护。

## 实现链
Windows 不是给每个浏览器单独写一份 manifest 文件，而是先用统一目录保存 manifest，再靠 `registerWindowsNativeHosts()` 去写各浏览器 registry key 指向它。代码先集中落点，再分发引用。

## 普通做法
普通做法是按浏览器各放一份文件，各自管理。

## 为什么不用
Claude Code 不这么做，因为 Windows 的 native messaging 生态本来就靠 registry 驱动，集中落点更容易保持一致。

## 代价
代价是要引入 `reg add` 这类平台专用逻辑，Windows 路径会明显比 Unix 路径更难读。

