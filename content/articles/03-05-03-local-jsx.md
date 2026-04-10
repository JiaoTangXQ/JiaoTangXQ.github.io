---
title: "面试题：/config 是怎么弹出配置面板的？为什么这是命令系统的一部分？"
slug: "03-05-03-local-jsx"
date: 2026-04-09
topics: [输入与路由]
summary: "local-jsx 型命令在终端里挂载一个临时 JSX 界面，等用户交互完成后才继续。这不是「在终端里夹一点 UI」，而是把「命令需要临时界面」这个现实纳入命令模型的正式成员。"
importance: 1
---

# 面试题：/config 是怎么弹出配置面板的？为什么这是命令系统的一部分？

## 场景推演

用户输入 `/config`，按 Enter。

不到一秒，终端里出现了一个可以用方向键导航的配置面板。用户做完选择，按 Escape，面板消失，会话继续。

这是怎么做到的？中间发生了什么？

## local-jsx 分支的执行逻辑

```typescript
case 'local-jsx': {
  return new Promise<SlashCommandResult>(resolve => {
    let doneWasCalled = false

    const onDone = (result?, options?) => {
      doneWasCalled = true
      
      if (options?.display === 'skip') {
        void resolve({ messages: [], shouldQuery: false, command, ... })
        return
      }

      // 组装 messages
      void resolve({
        messages: [
          createUserMessage({ content: formatCommandInput(command, args) }),
          result ? createUserMessage({ content: `<local-command-stdout>${result}</local-command-stdout>` })
                 : createUserMessage({ content: `<local-command-stdout>${NO_CONTENT_MESSAGE}</local-command-stdout>` }),
          ...metaMessages
        ],
        shouldQuery: options?.shouldQuery ?? false,
        command,
        ...
      })
    }

    void command.load().then(mod => mod.call(onDone, context, args))
      .then(jsx => {
        if (jsx == null) return
        if (doneWasCalled) return  // ← 防止 onDone 已经被调用的情况
        setToolJSX({
          jsx,
          shouldHidePromptInput: true,   // ← 隐藏输入框
          showSpinner: false,
          isLocalJSXCommand: true,
          isImmediate: command.immediate === true
        })
      })
  })
}
```

关键点：`getMessagesForSlashCommand` 返回的是一个 **未 resolve 的 Promise**。

这个 Promise 不会立刻完成，它等待着 `onDone` 被调用。`onDone` 只有在用户完成 UI 交互后才会被触发（比如选择了一个选项，或者按下 Escape）。

## setToolJSX 做了什么

`setToolJSX` 是一个注入到 `ProcessUserInputContext` 里的回调，签名类似：

```typescript
type SetToolJSXFn = (value: {
  jsx: React.ReactNode | null
  shouldHidePromptInput?: boolean
  showSpinner?: boolean
  isLocalJSXCommand?: boolean
  isImmediate?: boolean
  clearLocalJSX?: boolean
} | null) => void
```

调用 `setToolJSX({ jsx, shouldHidePromptInput: true })` 后：
- 这段 JSX 被挂到终端的当前渲染层
- 输入框被隐藏（`shouldHidePromptInput: true`），用户不能输入新命令
- 原来的会话显示被这个临时界面覆盖

当用户完成操作，config 命令调用 `onDone(result)`：
- Promise resolve，`getMessagesForSlashCommand` 返回结果
- 主流程继续
- `setToolJSX(null)` 在外层被调用，临时界面消失，输入框恢复

## 为什么这是命令系统的正式成员，而不是「特例」

在没有 `local-jsx` 的世界里，有两种替代方案：

**方案 A**：把 `/config` 做成一个独立的外部程序，启动时临时接管终端
- 问题：配置改变需要回传到当前会话，需要 IPC。两个进程之间的状态同步很复杂。

**方案 B**：把 `/config` 做成纯文本交互
- 问题：配置选项用文本列表展示和选择，体验很糟糕，尤其是有很多选项时。

**`local-jsx` 的方案**：命令系统承认「有些命令本质上需要临时 UI」，把这种需求纳入正式的类型系统，提供 `setToolJSX` 作为接口，让命令可以渲染自己的 JSX，等交互完成后通过 `onDone` 继续。

这样所有状态（当前会话、配置改变）都在同一个运行时里，不需要 IPC，也不需要把复杂选择题退化成文本列表。

## doneWasCalled 的防御逻辑

注意代码里有一个 `doneWasCalled` 的防御：

```typescript
if (doneWasCalled) return  // 在 setToolJSX 调用前
```

和：

```typescript
if (doneWasCalled) return  // 在错误处理里
void resolve({ messages: [], shouldQuery: false, command })
```

这处理了一个边界情况：有些命令在 `mod.call()` 里同步调用了 `onDone`（比如一些「立刻完成不需要显示界面」的命令），然后还返回了一个 JSX 节点。如果不检查 `doneWasCalled`，后来的 `setToolJSX` 调用会把界面挂上去，但 Promise 已经 resolve 了，`useQueueProcessor` 会认为命令结束，界面就永远悬挂在那里无法关闭。

这个细节说明 `local-jsx` 的并发语义需要仔细管理。

---

*面试指导：被问到「怎么在 CLI 工具里实现复杂的 UI 交互」时，`local-jsx` + `setToolJSX` + `onDone` Promise 这个模式是一个很好的例子。核心点是「把 UI 交互变成一个等待完成的 Promise」，让命令系统统一处理，而不是为每个有 UI 的命令单独实现一套 event loop 劫持逻辑。*
