---
title: "当前位置高亮要用 message-relative positions，说明滚动后重算 rowOffset 才不会漂"
slug: "11-09-35-message-relative-positionsrowoffset"
date: 2026-04-09
topics: [终端界面]
summary: "scanElement 给出的 positions 是 message-relative 的，真正的 yellow current 由 setPositions({ positions, rowOff..."
importance: 1
---

# 当前位置高亮要用 message-relative positions，说明滚动后重算 rowOffset 才不会漂

## 实现链
scanElement 给出的 positions 是 message-relative 的，真正的 yellow current 由 setPositions({ positions, rowOffset, currentIdx }) 结合当前 scrollTop 决定。只要 rowOffset 每次滚动都重算，高亮就不会跟着漂。

## 普通做法
普通实现常会直接记屏幕行号，或者把高亮位置当成静态坐标。那样一滚动，位置就会和消息内容脱钩。

## 为什么不用
这里必须用 message-relative positions，因为虚拟列表会移动，屏幕坐标不会自己保真。重算 rowOffset 才能把“当前命中”重新钉回真正的消息上。

## 代价
代价是搜索状态里要同时保存位置和当前 scrollTop，计算链也更长。好处是滚动后 current 仍然指向同一条命中，而不是一个旧屏幕坐标。
