---
title: "getCommands 装配流水线：动态技能是怎么插入命令列表的？"
slug: "07-04-02-getcommands"
date: 2026-04-09
topics: [扩展系统]
summary: "getCommands 不只是合并数组。它要处理 memoize 缓存、动态技能去重、可用性过滤，以及把动态技能插入到正确位置。这些细节揭示了命令注册表的真实复杂度。"
importance: 1
---

# getCommands 装配流水线：动态技能是怎么插入命令列表的？

## 系统设计题：命令注册表如何处理动态更新？

场景：一个 CLI 工具启动时加载了 100 个命令。用户在运行过程中打开了一个新项目，新项目有 5 个自定义技能。这 5 个技能应该怎么出现在命令列表里，同时不打断正在进行的其他操作？

这是 `getCommands` 解决的核心问题之一。

---

## 分层缓存架构

`getCommands` 使用了两层缓存：

**层一：`loadAllCommands`（按 cwd 缓存，重度 I/O）**

```typescript
const loadAllCommands = memoize(async (cwd: string): Promise<Command[]> => {
  const [
    { skillDirCommands, pluginSkills, bundledSkills, builtinPluginSkills },
    pluginCommands,
    workflowCommands,
  ] = await Promise.all([
    getSkills(cwd),
    getPluginCommands(),
    getWorkflowCommands ? getWorkflowCommands(cwd) : Promise.resolve([]),
  ])

  return [
    ...bundledSkills,
    ...builtinPluginSkills,
    ...skillDirCommands,
    ...workflowCommands,
    ...pluginCommands,
    ...pluginSkills,
    ...COMMANDS(),
  ]
})
```

这层缓存按 `cwd`（工作目录）键控。切换项目目录 → 缓存失效 → 重新加载。同一目录内的多次调用命中缓存，避免重复的磁盘 I/O。

**层二：可用性过滤（不缓存，每次重算）**

```typescript
export async function getCommands(cwd: string): Promise<Command[]> {
  const allCommands = await loadAllCommands(cwd)  // 命中缓存
  const dynamicSkills = getDynamicSkills()

  const baseCommands = allCommands.filter(
    _ => meetsAvailabilityRequirement(_) && isCommandEnabled(_),
  )
  // ...
}
```

注释说明了为什么不缓存这一层：

```typescript
/**
 * Not memoized — auth state can change mid-session (e.g. after /login),
 * so this must be re-evaluated on every getCommands() call.
 */
export function meetsAvailabilityRequirement(cmd: Command): boolean {
```

用户在会话中 `/login` 之后，可用命令集可能变化。如果把这一层也缓存了，登录后用户可能看到不该出现的命令（或看不到该出现的命令）。

---

## 动态技能的插入逻辑

这是 `getCommands` 最有趣的部分：

```typescript
const dynamicSkills = getDynamicSkills()

if (dynamicSkills.length === 0) {
  return baseCommands
}

// 去重：只添加 baseCommands 里没有的动态技能
const baseCommandNames = new Set(baseCommands.map(c => c.name))
const uniqueDynamicSkills = dynamicSkills.filter(
  s =>
    !baseCommandNames.has(s.name) &&
    meetsAvailabilityRequirement(s) &&
    isCommandEnabled(s),
)

if (uniqueDynamicSkills.length === 0) {
  return baseCommands
}

// 插入位置：在 pluginSkills 之后、内置命令之前
const builtInNames = new Set(COMMANDS().map(c => c.name))
const insertIndex = baseCommands.findIndex(c => builtInNames.has(c.name))

if (insertIndex === -1) {
  return [...baseCommands, ...uniqueDynamicSkills]
}

return [
  ...baseCommands.slice(0, insertIndex),
  ...uniqueDynamicSkills,
  ...baseCommands.slice(insertIndex),
]
```

**为什么要在特定位置插入，而不是追加到末尾？**

命令列表的顺序影响 UI 里的显示顺序和补全建议的优先级。`loadAllCommands` 里已经定义了来源的优先级顺序（bundled → builtinPlugin → skillDir → workflow → plugin → COMMANDS）。动态技能应该出现在 plugin 技能之后、内置命令之前——和它们的静态等价物位置一致。

追加到末尾会破坏这个语义，让动态技能看起来比内置命令更"后置"，影响用户的认知模型。

---

## clearCommandsCache 的级联清理

```typescript
export function clearCommandsCache(): void {
  clearCommandMemoizationCaches()   // 清 loadAllCommands + getSkillToolCommands + getSlashCommandToolSkills
  clearPluginCommandCache()          // 清插件命令缓存
  clearPluginSkillsCache()           // 清插件技能缓存
  clearSkillCaches()                 // 清技能目录缓存
}
```

这里有个微妙之处：`clearCommandMemoizationCaches` 专门注释说不清 skill caches：

```typescript
/**
 * Clears only the memoization caches for commands, WITHOUT clearing skill caches.
 * Use this when dynamic skills are added to invalidate cached command lists.
 */
export function clearCommandMemoizationCaches(): void {
  loadAllCommands.cache?.clear?.()
  getSkillToolCommands.cache?.clear?.()
  getSlashCommandToolSkills.cache?.clear?.()
  clearSkillIndexCache?.()
}
```

为什么区分这两种清理？因为"添加动态技能"只需要让命令列表重新计算，不需要重新扫描磁盘上的技能目录——后者是昂贵操作。只有真正的配置变化（用户修改了技能文件）才需要 `clearCommandsCache()`。

---

## 面试指导

**"如何设计一个支持动态更新的命令/路由注册表？"**

几个关键设计点：

1. **分层缓存**：重度 I/O 层缓存、轻量状态层不缓存。不能把"磁盘扫描结果"和"当前用户权限"缓存在同一层
2. **去重策略**：动态添加时先检查是否已存在，避免名字碰撞导致的不确定行为
3. **顺序语义**：命令的顺序有意义（优先级、UI 显示），插入时要保持这个语义
4. **精准失效**：区分"需要重扫磁盘"和"只需要重新过滤"两种失效场景，对应不同的清理函数

把这些点说清楚，比泛泛地说"用一个 Map 存命令，动态添加"更有说服力。
