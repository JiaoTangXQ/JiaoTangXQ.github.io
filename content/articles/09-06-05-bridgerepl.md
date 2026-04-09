---
title: "bridge 在 REPL 卸载时主动注销，说明外溢接口也要体面退场"
slug: "09-06-05-bridgerepl"
date: 2026-04-09
topics: [多Agent协作]
summary: "既然桥是跨层外溢接口，它就不能只负责出生，不负责死亡。 `leaderPermissionBridge.ts` 不只提供 register，也提供 `unregisterLeaderToolUseCo..."
importance: 1
---

# bridge 在 REPL 卸载时主动注销，说明外溢接口也要体面退场

既然桥是跨层外溢接口，它就不能只负责出生，不负责死亡。

## 实现链

`leaderPermissionBridge.ts` 不只提供 register，也提供 `unregisterLeaderToolUseConfirmQueue()` 和 `unregisterLeaderSetToolPermissionContext()`。这说明桥是带生命周期的，REPL 卸载或上下文变化时要主动清空。

## 普通做法

普通做法往往只注册不注销。反正进程快结束了，或者觉得全局变量无所谓。

## 为什么不用

Claude Code 不敢这么随便，因为 stale setter 会把后续请求送到已经不存在的 UI 上。团队系统里这种幽灵引用尤其难排查。

## 代价

代价是每条外溢桥都得有退出协议，实现者要时刻记得“全局变量不是永生的”。
