---
title: "面试题：设计一个跨设备 Agent 协作协议——Teleport API 是怎么做的？"
slug: "08-09-01-teleport-api"
date: 2026-04-09
topics: [远端与边界]
summary: "Teleport 的核心是「把机器 A 上的 Claude Code 会话，完整迁移到机器 B 继续执行」——需要解决认证一致性、历史消息传递、分支同步、git 工作目录重建四个问题，Teleport API 逐一应对。"
importance: 1
---

# 面试题：设计一个跨设备 Agent 协作协议——Teleport API 是怎么做的？

## 问题的难度在哪里

"跨设备继续一个对话"听起来不难——聊天应用里很常见。但 Claude Code 的 Teleport 要解决的不只是消息同步，而是**完整的工作环境迁移**：

- 机器 A 上有一个进行中的编码任务，包含数十条对话历史
- 任务在一个特定的 git 分支上进行，有本地未提交的改动
- 机器 B 需要"接管"这个任务，继续执行，不丢失任何上下文

普通的消息同步只解决了"对话内容"。Teleport 还需要解决：git 状态、工作目录内容、认证上下文、会话元数据。

## 三层准备工作

`utils/teleport/api.ts` 里的 `prepareApiRequest()` 是所有 Teleport 操作的前置条件：

```typescript
async function prepareApiRequest() {
  // 1. 必须是 Claude.ai OAuth，不接受 API key
  const token = getClaudeAIOAuthTokens()?.accessToken
  if (!token) throw new Error('Claude.ai account required...')
  
  // 2. 获取组织 UUID
  const orgUUID = await getOrganizationUUID()
  if (!orgUUID) throw new Error('Unable to get organization UUID')
  
  // 3. 返回带组织头的请求配置
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-uuid': orgUUID,
    }
  }
}
```

为什么三步都必要？

**OAuth 而不是 API key**：Teleport 要在两台机器之间同步会话，这意味着会话必须存储在服务端（而不是本地），需要 Claude.ai 账户的 Sessions API。API key 只有推理能力，没有 Sessions API 访问权。

**组织 UUID**：会话属于组织，API 需要知道操作的是哪个组织的会话。组织 UUID 是每次 API 请求的必要路由信息。

**统一的请求头生成**：所有后续 API（列会话、读历史、更新标题）都使用同一套认证头，避免每个函数各自处理认证。

## 会话列表的可选性

`fetchSession` 支持通过 `sessionId` 直接定位，也支持通过 `anchor_to_latest` 拉取最近的会话列表让用户选择：

```typescript
export async function fetchSession(
  sessionId?: string
): Promise<SessionResource | null> {
  if (sessionId) {
    // 直接定位
    return fetchSpecificSession(sessionId)
  }
  // 拉最近的会话让用户选
  return fetchLatestSession()
}
```

这两条路径对应不同的使用场景：

- **有 sessionId**：用户从命令行传入 `--session-id`，或者从 URL/二维码扫描得到，直接定位
- **没有 sessionId**：用户运行 `claude teleport`，系统列出最近的会话，让用户选一个

灵活性来自：不假设用户知道 sessionId，也不拒绝用户提供 sessionId。

## 重试机制

Teleport API 调用可能在网络不稳定时失败，`axiosGetWithRetry` 实现了指数退避重试：

```typescript
const TELEPORT_RETRY_DELAYS = [2000, 4000, 8000, 16000] // 4 次重试

async function axiosGetWithRetry(url, config) {
  for (let attempt = 0; attempt <= MAX_TELEPORT_RETRIES; attempt++) {
    try {
      return await axios.get(url, config)
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error  // 4xx 不重试
      if (attempt >= MAX_TELEPORT_RETRIES) throw error  // 重试耗尽
      await sleep(TELEPORT_RETRY_DELAYS[attempt])
    }
  }
}
```

关键设计：`isTransientNetworkError` 区分了 4xx（客户端问题，不重试）和 5xx/网络错误（服务端/网络问题，重试）。

对 4xx 不重试的原因：4xx 通常代表"请求本身有问题"（认证失败、会话不存在、权限不足），重试相同的请求不会改变结果，只是浪费时间。

## 分支信息的获取

Teleport 还需要知道会话在哪个 git 分支上运行，以便在机器 B 上签出正确的分支：

```typescript
export function getBranchFromSession(session: SessionResource): string | null {
  // 从 session 元数据里提取分支信息
  // 如果 session 创建时没有记录分支，返回 null
  return session.metadata?.branch ?? null
}
```

如果分支信息缺失（旧版本的 session 没有记录），Teleport 会降级处理：在机器 B 上使用默认分支，通知用户分支信息丢失。这是一个合理的降级：损失了分支上下文，但不阻止迁移进行。

## Teleport 的完整流程

把这些 API 串起来，Teleport 的完整流程是：

```
1. prepareApiRequest()                → 认证 + 组织 UUID
2. fetchSession(sessionId?)           → 找到目标会话
3. fetchHistory(session.id)           → 拉取历史消息（SDKMessage[]）
4. getBranchFromSession(session)      → 获取 git 分支
5. checkoutBranch(branch)             → 在本地签出分支
6. deserializeMessages(history)       → 把历史转成本地 Message[]
7. 启动新的 Claude 实例，注入历史     → 接管会话
```

每一步都有可能失败，每一步的失败都需要不同的错误信息和降级策略。

## 面试指导

"设计一个跨设备继续工作的 Agent 协议"是系统设计面试中难度较高的题目。

答题框架：

1. **识别需要同步的状态**：对话历史（消息）、工作目录（git 状态）、执行上下文（分支、模型设置）、认证信息
2. **分析各类状态的同步方式**：历史可以通过 API 拉取，git 状态需要特殊处理（bundle），认证需要账户体系
3. **设计失败降级**：分支信息丢失时怎么办？历史拉取失败时怎么办？
4. **讨论一致性保证**：如果两台机器同时打开同一个 session 会怎样？（这是 Teleport 在这个版本里没有完全解决的问题）

Claude Code 的 Teleport 是"实用主义"的实现：在大多数情况下工作良好，在边缘情况（如并发访问）有已知限制，但在产品阶段这是合理的权衡。
