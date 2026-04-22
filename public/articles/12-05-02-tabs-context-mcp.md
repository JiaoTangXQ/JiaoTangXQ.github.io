---
title: "调试技巧：tabs_context_mcp 调用失败时怎么排查 Claude in Chrome 的状态？"
slug: "12-05-02-tabs-context-mcp"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 调试技巧：tabs_context_mcp 调用失败时怎么排查 Claude in Chrome 的状态？

## tabs_context_mcp 是一个「现场快照」

`prompt.ts` 里对 `tabs_context_mcp` 的描述非常直接：

```ts
## Tab context and session startup

IMPORTANT: At the start of each browser automation session, call mcp__claude-in-chrome__tabs_context_mcp 
first to get information about the user's current browser tabs. Use this context to understand what 
the user might want to work with before creating new tabs.
```

这个工具的作用是：**在每次浏览器会话开始时，先读取用户当前浏览器的真实状态**。

有人可能会问：为什么要这么麻烦？直接让模型说"打开一个新标签，导航到 URL"不是更简单？

答案在"真实浏览器"这个产品选择上。用户可能已经打开了目标页面；用户可能刚刚在 Agent 上次工作的标签页上做了修改；用户可能有十几个标签页，有些已经失效。不先读取当前状态，就是在真实现场里蒙眼工作。

## 两种会话启动策略的对比

**策略一：总是创建新标签**（沙盒思维）
```ts
// 假设的简单实现
await tabs.create({ url: 'about:blank' })
await tabs.navigate(tabId, targetUrl)
```

优点：干净，可重复，不受之前状态影响。  
缺点：用户的真实工作现场被忽略；如果用户已经打开了目标页面，这是浪费；已登录状态需要重新建立。

**策略二：先读取现场，再决定（Claude in Chrome 的方式）**
```ts
// prompt.ts 要求的顺序
1. 调用 tabs_context_mcp → 了解当前有哪些标签页
2. 判断是否有可复用的标签页
3. 如果有，复用；如果没有，创建新的
```

这种方式让模型能做出更智能的决策，比如"用户已经在 GitHub 上了，就在那个标签页里继续"。

## toolRendering.tsx 里的 tabId 追踪

`toolRendering.tsx` 里有一个专门追踪 tab ID 的机制：

```ts
trackClaudeInChromeTabId(tabId)
```

这个追踪不只是为了 UI 展示，还用于在工具调用结果里渲染 `[View Tab]` 链接——让用户能直接跳到 Agent 正在操作的那个标签页。

这个设计背后有一个重要假设：**用户想知道 Agent 在哪里工作，并且应该能随时查看**。真实浏览器场景里，Agent 在用户的浏览器上做操作，用户有权实时监督。这个 `[View Tab]` 链接就是这种监督权的技术实现。

## tabs_context_mcp 失败的排查路径

当 `tabs_context_mcp` 调用失败时，问题可能在以下几层：

**第一层：扩展连接**

`tabs_context_mcp` 是 Chrome 扩展提供的工具。如果这个调用直接失败（而不是返回空列表），最可能的原因是扩展没有连接到 Native Host。

排查步骤：
1. 检查 Chrome 扩展是否已安装（`chrome://extensions/`）
2. 检查 Native Host manifest 是否存在（macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`）
3. 检查 Claude Code 进程是否在运行

**第二层：账号一致性**

错误 `onAuthenticationError` 说明账号不匹配。Claude Code 和 Chrome 扩展必须用同一个 claude.ai 账号登录。

排查步骤：
1. 在终端检查 `claude auth status`
2. 在 Chrome 里检查扩展使用的账号
3. 如果不一致，重新登录其中一个

**第三层：socket 连接**

`getAllSocketPaths()` 会返回所有候选的 socket 路径，包括当前进程的 `pid.sock` 和 legacy fallback 路径。

```ts
export function getAllSocketPaths(): string[] {
  const paths: string[] = []
  // 扫描 /tmp/claude-mcp-browser-bridge-{username}/ 目录
  const files = readdirSync(socketDir)
  for (const file of files) {
    if (file.endsWith('.sock')) {
      paths.push(join(socketDir, file))
    }
  }
  // 加上 legacy fallback 路径
  paths.push(legacyTmpdir)
  paths.push(legacyTmp)
  return paths
}
```

如果 socket 目录里有多个 `.sock` 文件（来自多个 Claude Code 进程），扩展可能连接到了错误的进程。可以通过检查进程 PID 来判断：
```
ls -la /tmp/claude-mcp-browser-bridge-{username}/
# 每个文件名是 {pid}.sock
# 检查对应 PID 的进程是否还在
```

**第四层：标签页权限**

某些网站（如 chrome:// URL、扩展页面）可能不允许扩展读取标签内容。`tabs_context_mcp` 可能返回空的标签信息，而不是完整的标签数据。

## 最常见的"失效但不报错"场景

有一种特别难调试的情况：`tabs_context_mcp` 调用成功，但返回的标签 ID 已经失效（用户关掉了那个标签），导致后续操作失败。

`prompt.ts` 对此有明确的处理建议：

```ts
3. If a tool returns an error indicating the tab doesn't exist or is invalid, 
   call tabs_context_mcp to get fresh tab IDs
4. When a tab is closed by the user or a navigation error occurs, call 
   tabs_context_mcp to see what tabs are available
```

这个模式——**操作失败时重新读取现场快照**——是处理真实浏览器状态不稳定性的核心策略。真实浏览器里，任何状态都可能在下一秒被用户改变，Agent 必须有一套"我迷路了，重新定向"的机制。

## 面试考察点

这道题考察的是**如何设计面对真实世界不稳定状态的 Agent**。

沙盒环境里，状态是可控的，Agent 可以假设"我做了 X，状态一定是 Y"。真实环境里，Agent 需要在每个关键节点验证状态，而不是假设状态是预期的。

`tabs_context_mcp` 作为每次会话的第一步，以及在异常后重新调用作为恢复策略，体现的是同一个设计原则：**在不可控的真实环境里工作的 Agent，需要有显式的状态探测步骤，而不是依赖隐式假设**。

