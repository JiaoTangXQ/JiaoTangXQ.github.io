---
title: "ide_connected通知失败也不拖主连接说明礼节不能压过主路"
slug: "07-07-07-ide-connected"
date: 2026-04-09
topics: [扩展系统]
summary: "- `client.ts` 连上 server 之后会顺手 `maybeNotifyIDEConnected(client)`，但这一步是 `void` 调用并且失败只记日志，不会把主连接判成失败。 ..."
importance: 1
---

# ide_connected通知失败也不拖主连接说明礼节不能压过主路

## 实现链
- `client.ts` 连上 server 之后会顺手 `maybeNotifyIDEConnected(client)`，但这一步是 `void` 调用并且失败只记日志，不会把主连接判成失败。
- 这说明 `ide_connected` 在 Claude Code 这里是礼节性通知，不是连接成立的前提。

## 普通做法
- 普通做法是把所有握手相关通知都算进“连接成功”流程里，任何一步失败都整体回滚。
- 这种写法状态上更整齐，因为成功就是全套都成功。

## 为什么不用
- Claude Code 没把这一步抬到主路，是因为 IDE 附带通知和工具/资源主连接的重要性根本不是一个量级。
- 如果为了一个礼节性通知拖垮整条 MCP 主链，那就是让次要礼仪压过主要工作。

## 代价
- 代价是 server 端有时会不知道 IDE 其实已经连上，少了一点附加上下文。
- 但这比把整个连接稳定性押在通知成功上要合理得多。
