---
title: "面试题：为什么 Claude in Chrome 要接用户真实浏览器而不是起一个干净的沙盒？"
slug: "12-05-01-claude-in-chrome"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 面试题：为什么 Claude in Chrome 要接用户真实浏览器而不是起一个干净的沙盒？

## 两种截然不同的产品定位

浏览器自动化领域有两种主流技术路线：

**沙盒路线（Puppeteer/Playwright）**：程序自己起一个受控浏览器实例，登录态、Cookie、扩展、历史记录全部干净。适合测试、爬虫、批量数据处理。

**真实浏览器路线**：接入用户正在使用的那个浏览器，继承用户的所有会话状态。适合"替用户在已登录网站上做事"。

这两种路线不是好坏之分，而是解决不同问题的工具。Claude Code 的 `prompt.ts` 第一句话就把立场说清楚了：

```ts
export const BASE_CHROME_PROMPT = `# Claude in Chrome browser automation

You have access to browser automation tools (mcp__claude-in-chrome__*) for interacting with web pages in Chrome.

## Tab context and session startup

IMPORTANT: At the start of each browser automation session, call mcp__claude-in-chrome__tabs_context_mcp 
first to get information about the user's current browser tabs.`
```

"用户当前的标签页"——这就是真实浏览器路线的明确声明。

## 真实浏览器路线的产品逻辑

考虑一个典型场景：用户说"帮我把今天的 GitHub PR review comments 汇总一下"。

**沙盒路线的过程**：
1. 起新浏览器实例
2. 导航到 GitHub
3. 触发 OAuth 登录流程
4. 获取授权
5. 才能开始真正的任务

用户已经登录了 GitHub，但 Agent 要绕一大圈才能复用这个状态。

**真实浏览器路线的过程**：
1. 读取当前打开的标签页
2. 如果已有 GitHub PR 页面，直接在这个标签页上工作
3. 如果没有，新开一个标签，GitHub 已登录状态自动继承

这是两种不同的时间起点：一个从零开始，一个从用户当前的工作现场开始。

对于"AI 替用户做事"这个目标，从用户已有的现场继续往往才是正确的起点。用户已经在那里了，AI 应该加入，而不是另开一个平行宇宙。

## 接真实浏览器带来的工程债务

这个产品选择的代价是：系统必须处理所有"真实现场"带来的复杂性。

**标签页状态不可控**：用户可能在 Agent 工作过程中手动关了某个标签。`prompt.ts` 里的指导：

```ts
3. If a tool returns an error indicating the tab doesn't exist or is invalid, 
   call tabs_context_mcp to get fresh tab IDs
```

**阻塞式对话框是致命的**：真实浏览器里，JavaScript alert 会阻塞所有后续操作，让扩展陷入死锁。`prompt.ts` 专门有一整段处理这个问题：

```ts
## Alerts and dialogs

IMPORTANT: Do not trigger JavaScript alerts, confirms, prompts, or browser modal dialogs 
through your actions. These browser dialogs block all further browser events and will 
prevent the extension from receiving any subsequent commands.
```

**账号一致性**：Claude Code 和浏览器必须用同一个 claude.ai 账号登录，否则配对失败。`createChromeContext()` 的 `onAuthenticationError` 回调专门处理这个问题：

```ts
onAuthenticationError: () => {
  logger.warn(
    'Authentication error occurred. Please ensure you are logged into the Claude 
     browser extension with the same claude.ai account as Claude Code.',
  )
},
```

**OAuth token 管理**：真实浏览器场景需要管理真实的 OAuth token，用于 bridge 连接。

```ts
bridgeConfig: {
  getUserId: async () => getGlobalConfig().oauthAccount?.accountUuid,
  getOAuthToken: async () => getClaudeAIOAuthTokens()?.accessToken ?? '',
}
```

**配对设备身份**：真实浏览器需要持久化配对身份，`pairedDeviceId` 写回全局配置。

这些复杂度在沙盒方案里完全不存在，因为沙盒每次都是干净的。但沙盒无法替用户在已登录的网站上工作。

## pairedDeviceId 的设计意图

`createChromeContext()` 里的配对持久化设计值得单独讨论：

```ts
onExtensionPaired: (deviceId: string, name: string) => {
  saveGlobalConfig(config => {
    if (
      config.chromeExtension?.pairedDeviceId === deviceId &&
      config.chromeExtension?.pairedDeviceName === name
    ) {
      return config  // 没变化，不写
    }
    return { ...config, chromeExtension: { pairedDeviceId: deviceId, pairedDeviceName: name } }
  })
},
getPersistedDeviceId: () => getGlobalConfig().chromeExtension?.pairedDeviceId,
```

这里有两个设计细节：
1. **内容不变就不写**：避免不必要的磁盘 IO 和配置文件"惊动"
2. **写回全局配置**：配对身份是工作台级别的长期状态，不是单次会话的临时变量

这说明设计者把浏览器扩展理解为工作台的一个**长期协作设备**，而不是一个每次重新配对的临时外设。真实浏览器路线要求这种"记住你"的长期关系。

## 面试考察点

这道题考察的是**产品设计决策与技术架构之间的连锁关系**。

面试中遇到"为什么不用 Puppeteer/Playwright 这种更成熟的方案"这类问题时，要展现的判断是：

**技术选型不是孤立的**。选择真实浏览器路线，意味着接受了一整套相关的工程复杂度：Native Messaging、扩展安装、账号配对、状态管理、断线处理。

**沙盒方案解决的是不同的问题**。Puppeteer 适合"在干净环境里可重复执行的自动化任务"，Claude in Chrome 适合"在用户真实工作现场里接管任务"。

**产品定位决定了技术约束**。Claude Code 的定位是工作台助手，而不是测试框架或爬虫工具。工作台助手需要在用户的现实环境里工作，这个需求决定了技术方向。

