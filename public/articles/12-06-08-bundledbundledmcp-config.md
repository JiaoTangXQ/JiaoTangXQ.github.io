---
title: "架构分析：bundled 和非 bundled 模式为什么要输出同一套 MCP 配置？"
slug: "12-06-08-bundledbundledmcp-config"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 架构分析：bundled 和非 bundled 模式为什么要输出同一套 MCP 配置？

## 两种打包形态

Claude Code 有两种运行方式：

**Bundled 模式**：打包成单个可执行文件（native binary），所有 JS 代码都预先编译打包。`process.execPath` 就是 Claude Code 本身。

**非 Bundled 模式**：通过 Node.js 运行 JS 代码。`process.execPath` 是 Node.js，还需要指定 `cli.js` 的路径。

这两种模式在"如何启动子进程"上完全不同，`setupClaudeInChrome()` 里有明确的分支处理：

```ts
export function setupClaudeInChrome(): { mcpConfig, allowedTools, systemPrompt } {
  const isNativeBuild = isInBundledMode()

  if (isNativeBuild) {
    // Bundled：直接用当前二进制 + 参数
    const execCommand = `"${process.execPath}" --chrome-native-host`
    void createWrapperScript(execCommand)...
    
    return {
      mcpConfig: {
        [CLAUDE_IN_CHROME_MCP_SERVER_NAME]: {
          type: 'stdio' as const,
          command: process.execPath,
          args: ['--claude-in-chrome-mcp'],  // 直接带参数
          scope: 'dynamic' as const,
        },
      },
      allowedTools,
      systemPrompt: getChromeSystemPrompt(),
    }
  } else {
    // 非 Bundled：用 Node.js + cli.js 路径 + 参数
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = join(__filename, '..')
    const cliPath = join(__dirname, 'cli.js')

    void createWrapperScript(`"${process.execPath}" "${cliPath}" --chrome-native-host`)...
    
    return {
      mcpConfig: {
        [CLAUDE_IN_CHROME_MCP_SERVER_NAME]: {
          type: 'stdio' as const,
          command: process.execPath,
          args: [`${cliPath}`, '--claude-in-chrome-mcp'],  // Node + cli.js + 参数
          scope: 'dynamic' as const,
        },
      },
      allowedTools,
      systemPrompt: getChromeSystemPrompt(),
    }
  }
}
```

两个分支的 `command` 和 `args` 不同，但其他所有字段（`type`、`scope`、allowedTools 的内容、systemPrompt）完全相同。

## 为什么要保持返回值结构一致

返回值的消费方（`main.tsx`、工具发现逻辑、权限系统）不需要知道 Claude Code 是 bundled 还是非 bundled 运行的。它们只关心：
- 这个 server 的 type 是什么（`stdio`）
- 工具名有哪些
- 需要追加什么 system prompt

如果 bundled 和非 bundled 返回的结构不同，消费方就需要加条件分支：

```ts
// 假设的坏设计
if (isBundledMode) {
  setupWithBundledConfig()
} else {
  setupWithNonBundledConfig()
}
```

这让消费方知道了它本来不需要知道的信息（打包方式），增加了不必要的耦合。

## isInBundledMode() 的隔离作用

`isInBundledMode()` 这个函数把"打包方式检测"这个逻辑隔离在一个地方，`setupClaudeInChrome()` 和 `setupComputerUseMCP()` 在内部用这个函数做分支，但对外暴露的是统一的接口。

```ts
// computerUse 的同样模式
const args = isInBundledMode()
  ? ['--computer-use-mcp']
  : [join(fileURLToPath(import.meta.url), '..', 'cli.js'), '--computer-use-mcp']
```

这是一个"把差异吸收在接缝处"的设计：差异在函数内部处理完，对外不暴露。

## 开发者体验的一致性

对 Claude Code 的开发者来说，这种一致性很有价值：无论他们在哪种模式下工作（开发时用非 bundled，发布时用 bundled），Chrome 功能的行为表现是完全一样的。

工具名一样、权限一样、system prompt 一样。开发时调试出来的行为，在 bundled 版本里会完全一样。

如果两种模式的行为有差异，开发者在开发阶段测试的结果就不能代表发布版本的行为，这会显著增加调试难度。

## 面试考察点

这道题考察的是**在多种部署形态下保持接口一致性**的架构思维。

一个推论：当你设计一个需要在多种环境/形态里运行的系统（开发/生产、容器/裸机、bundled/非 bundled），一个很有价值的设计原则是：**让环境差异在接入层消化，不要让它泄漏到业务逻辑层**。

接入层知道所有的环境差异，业务逻辑层面对的是统一的抽象。这样的系统在不同环境里运行时，业务逻辑不需要修改。

Claude Code 的 `setupClaudeInChrome()` 是这个原则的一个小而清晰的实现。

