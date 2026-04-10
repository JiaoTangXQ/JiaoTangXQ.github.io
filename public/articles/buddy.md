---
title: "Buddy 的动画状态机怎么根据 Agent 状态切换？"
slug: "buddy"
date: 2026-04-09
topics: [终端界面]
summary: "彩蛋设计：Buddy 不只是一个会动的像素小动物。它的动画帧、气泡颜色、宽窄布局和输入框染色，都有明确的触发逻辑，而且全部接在已有的状态机上。"
importance: 1
---

# Buddy 的动画状态机怎么根据 Agent 状态切换？

## 彩蛋设计：不只是会动的像素

第一次看到 `/buddy` 命令，大多数人的反应是"这是个有趣的彩蛋"。但如果仔细读 `CompanionSprite.tsx` 的代码，会发现 Buddy 的实现远不止"展示一个动画"——它是一套有完整状态机的体验层，而且每一个设计决定都有明确的工程理由。

## 动画状态机的三个分支

`CompanionSprite.tsx` 里的动画逻辑围绕三个互斥状态展开：

**空闲状态（idle）**：使用预定义的 `IDLE_SEQUENCE` 序列：

```typescript
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];
```

序列里的 `0` 是静止帧，`1` 和 `2` 是轻微的躁动帧，`-1` 触发眨眼效果（把眼睛替换成 `-`）。整体节奏是"大部分时间静止，偶尔动一下，偶尔眨眼"。这个节奏是刻意的——它让 Buddy 有存在感，但不抢主界面的注意力。

**兴奋状态（reaction 或 petting）**：当有新的 `companionReaction` 或 `/buddy pet` 刚发生时，切换到快速循环所有帧：

```typescript
if (reaction || petting) {
  spriteFrame = tick % frameCount; // 快速循环
} else {
  // idle 序列
}
```

兴奋状态下 Buddy 会快速切换所有动画帧，配合气泡或爱心效果，给用户明确的视觉反馈。

**眨眼效果**：`step === -1` 时不切换帧，而是对当前帧做文字替换：

```typescript
const body = renderSprite(companion, spriteFrame).map(line =>
  blink ? line.replaceAll(companion.eye, '-') : line
)
```

眼睛字符被换成 `-`，形成眨眼动画。这个实现很紧凑：不需要为眨眼单独设计帧，只需要临时替换眼睛符号。

## 气泡颜色与稀有度绑定

Buddy 的气泡边框颜色不是随机的，而是由伴侣的稀有度决定：

```typescript
const color = RARITY_COLORS[companion.rarity]
```

稀有度对应的颜色从 `types.ts` 里读：

```typescript
export const RARITY_COLORS = {
  common: 'inactive',
  uncommon: 'success',
  rare: 'permission',
  epic: 'autoAccept',
  legendary: 'warning',
}
```

`common` 的气泡是暗色的（`inactive`），`legendary` 的气泡是金色的（`warning`）。用户平时可能不会注意到这个细节，但如果他们有一只 legendary 的 Buddy，气泡颜色会告诉他们这件事。

## 宽窄布局的自适应

终端宽度决定 Buddy 以什么形态出现：

```typescript
export const MIN_COLS_FOR_FULL_SPRITE = 100; // 完整 sprite 需要 100 列

if (columns < MIN_COLS_FOR_FULL_SPRITE) {
  // 窄终端：折叠成一行脸
  return <Box paddingX={1} alignSelf="flex-end">
    <Text bold color={color}>{renderFace(companion)}</Text>
    <Text italic>{label}</Text>
  </Box>;
}
// 宽终端：完整 sprite + 气泡
```

窄终端下，Buddy 变成一个单行的"脸 + 名字"，不占垂直空间。宽终端下才展开完整的 5 行像素形态和气泡。`companionReservedColumns()` 还会把 Buddy 占据的列数告诉 `PromptInput`，让输入框不会被 sprite 遮住。

## isBuddyTeaserWindow：时间窗口的工程设计

`useBuddyNotification.tsx` 里有一个有趣的细节：

```typescript
export function isBuddyTeaserWindow(): boolean {
  if ("external" === 'ant') return true; // 内部构建始终显示
  const d = new Date();
  return d.getFullYear() === 2026 && d.getMonth() === 3 && d.getDate() <= 7;
}
```

注释里写明了原因：**使用本地时间而非 UTC**，是为了让 24 小时内的推特热度均匀分布在不同时区，而不是集中在 UTC 午夜形成一个单峰。这是一个考虑了社交传播效果的工程决定。

彩虹 `/buddy` 提示只在 2026 年 4 月 1 日到 7 日显示（用户还没有孵化伴侣时）。命令本身在 4 月之后永久可用。内部构建（`"external" === 'ant'`，会在编译时被替换）始终显示预告。

## 体验层先借现有操纵面

`findBuddyTriggerPositions()` 扫描用户输入里的 `/buddy` 位置，`PromptInput` 用这些位置把对应字符染成彩虹色。Buddy 没有自己的专属入口，它借的是主输入区已有的排版和高亮机制。

这个选择保证了 Buddy 是"主界面里的一个存在"，而不是"另一个独立的面板"。用户不需要学习第二套操作习惯，只需要在主输入框里输入 `/buddy`。

## 面试指导

被问"如果你要给一个 CLI 工具加一个吉祥物功能，你会怎么设计"时，Buddy 的实现给出了几个具体的原则：

1. 借用现有的状态管理，不另建专属数据流
2. 用稀有度/等级这类已有的属性驱动视觉差异，而不是单独维护外观配置
3. 自适应终端宽度，确保窄窗口不被破坏
4. 时间触发的彩蛋使用本地时区，考虑传播效果

这些原则展示的是"体验层的工程成熟度"——不只是能显示，而是每个细节都有理由。
