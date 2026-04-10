---
title: "showSetupScreens() 里的十几个对话框——顺序是怎么决定的？"
slug: "02-06-02-showsetupscreens"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: "系统设计式分析：showSetupScreens() 里有十几个首次启动检查，包括 onboarding、trust、MCP 审批、企业政策、API key 确认等。这个顺序是随意的还是有约束的？"
importance: 1
---

# showSetupScreens() 里的十几个对话框——顺序是怎么决定的？

## 完整的执行序列

`showSetupScreens()` 里的操作（按实际执行顺序，简化）：

```
1. onboarding screens（欢迎/功能介绍）
2. trust dialog（工作区信任确认）
   ↓ trust 通过后才继续
3. GrowthBook 重新初始化（refreshGrowthBookAfterAuthChange）
4. getSystemContext() 预取启动（git 命令，需要 trust）
5. MCP JSON 审批（.mcp.json 里的新服务器）
6. CLAUDE.md 外部引用检查
7. 仓库路径映射更新（filterExistingPaths）
8. 完整环境变量应用（applyConfigEnvironmentVariables）
9. 遥测初始化（initializeTelemetryAfterTrust）
   ↓ 后续对话框
10. Grove/Grove policy 警告（企业政策提示）
11. 自定义 API key 审批
12. 危险跳过权限模式提示（--dangerously-skip-permissions）
13. auto mode opt-in 提示
14. 开发频道确认（--channels）
15. Claude in Chrome 首次引导
```

## 哪些顺序是有约束的？

**约束一：Trust 必须在 MCP 审批之前**

`.mcp.json` 里的 MCP 服务器是来自项目目录的配置。执行 MCP 审批（问用户是否允许这些服务器）之前，必须先确认这个项目目录是可信的——否则在不信任的目录里展示 MCP 审批，就是在用户还没确认信任这个项目的情况下，展示来自这个项目的工具列表。

**约束二：Trust 必须在 CLAUDE.md 外部引用检查之前**

CLAUDE.md 里可能有 `@external-file.md` 这样的外部引用。检查这些引用（并可能读取外部文件）是一个读文件操作，来自项目目录。在 trust 确认之前，不该读取来自不信任项目的文件。

**约束三：Trust 必须在完整环境变量应用之前**

`.claude/settings.json` 里可能有项目级别的 `env` 配置。应用这些环境变量之前，必须确认项目可信——不信任的项目可能通过 `env` 注入恶意变量。

**约束四：GrowthBook 重新初始化在 Trust 之后**

GrowthBook（feature flag 系统）初始化时会做认证，认证结果可能影响后续对话框是否显示（某些功能门控）。Trust 确认后认证状态可能发生变化（比如 OAuth 信息被确认了），所以需要在 trust 后重新初始化。

## 哪些顺序是"最佳实践"而非硬约束？

**auto mode opt-in 在 MCP 审批之后**

Auto mode 要求用户明确 opt-in。但用户是否选择 auto mode，可能影响他们对 MCP 服务器的审批决策（auto mode 下 MCP 工具会更自由地被调用）。

理论上可以倒过来，但先完成 MCP 审批（"这些工具你允许吗"），再问 auto mode（"允许工具自动调用吗"），语义上更自然。

**onboarding 在 trust 之前**

Onboarding 屏幕是纯介绍性的，不会产生任何副作用，不需要信任前提。放在 trust 之前，让新用户在确认信任之前先了解工具是什么，可以帮助他们做出更有信息的信任决策。

**危险权限模式提示在 trust 之后**

`--dangerously-skip-permissions` 是一个明确的危险操作。在 trust 确认后再提示这个警告，确保用户已经处于"完整认知"状态——他们知道这是一个真实的工作目录，才能更认真地对待"跳过所有权限检查"这个决定。

## 条件性显示

不是所有对话框都每次都会显示：

```typescript
// 只在满足特定条件时显示
if (hasMcpJsonApprovals) {
  await processMcpJsonApprovals(...)
}
if (!hasClaudeInChromeBeenShownBefore && shouldEnableClaudeInChrome()) {
  await showClaudeInChromeFirstTime()
}
```

这意味着"哪些对话框会出现"是动态决定的，但"如果出现，它们的相对顺序"是固定的。

## 面试指导

这种"有条件的顺序序列"在系统初始化、wizard 流程、onboarding 体验里很常见。

设计要点：
1. **识别硬约束**（B 必须在 A 之后）：通常来自安全要求、数据依赖、状态依赖
2. **识别软约束**（A 在 B 之前更合理）：通常来自用户理解顺序、认知负荷
3. **条件性 vs 必要性**：某个步骤可以不出现，但如果出现，必须在特定位置

能分析出"为什么这个顺序"，比"记住这个顺序"更有价值。安全相关的顺序约束，通常能追溯到"什么信息应该在什么时候才能被信任"这个核心问题。
