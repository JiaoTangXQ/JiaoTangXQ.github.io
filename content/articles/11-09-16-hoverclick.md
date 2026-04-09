---
title: "稳定 hover 和 click 处理器，说明滚动时不能顺手制造成堆短命垃圾"
slug: "11-09-16-hoverclick"
date: 2026-04-09
topics: [终端界面]
summary: "handlersRef 把 onItemClick 和 setHoveredKey 收在一起，再用 useCallback 做稳定的 onClickK、onEnterK、onLeaveK。这样 Vir..."
importance: 1
---

# 稳定 hover 和 click 处理器，说明滚动时不能顺手制造成堆短命垃圾

## 实现链
handlersRef 把 onItemClick 和 setHoveredKey 收在一起，再用 useCallback 做稳定的 onClickK、onEnterK、onLeaveK。这样 VirtualItem 的闭包数量不再跟着每次滚动翻倍。

## 普通做法
普通实现会在每个 item 上直接写内联箭头函数。那样读起来省事，但 fast scroll 时会不断生成和回收短命闭包。

## 为什么不用
这里不想让滚动顺手制造垃圾，因为列表已经在做虚拟化和测量了，没必要再给 GC 加压。稳定处理器能让未变的项继续复用，也让 memo 更容易命中。

## 代价
代价是事件流多了一层间接访问，调试时也得顺着 ref 往回找。好处是长列表滚动更平稳，CPU 和 GC 都少背一层锅。
