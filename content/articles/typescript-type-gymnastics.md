---
title: "TypeScript 类型体操：有用还是炫技？"
slug: typescript-type-gymnastics
date: 2026-01-15
topics: [技术]
summary: "高级类型操作到底是工程实践还是智力游戏？什么时候该用，什么时候该克制。"
cover:
  style: gradient
  accent: "#3a7fff"
importance: 1.1
---

## 类型体操的诱惑

TypeScript 的类型系统是图灵完备的。这意味着你理论上可以在类型层面做任何计算。

Template literal types、conditional types、infer、mapped types 的组合让你可以写出这样的东西：

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

刚学会这些时，你会想把它用在所有地方。这就是陷阱的开始。

## 什么时候类型体操有价值

在这些场景中，复杂类型是值得的：

1. **库的公共 API** —— 用户不看你的源码，类型就是他们的文档。精确的类型能防止误用。
2. **数据转换管线** —— 输入 A 类型，输出 B 类型，中间有 5 步转换。如果类型能跟踪整个过程，重构时会安全得多。
3. **配置系统** —— 当配置选项之间有依赖关系（选了 A 才能配 B），类型约束比运行时检查更早发现问题。

## 什么时候应该克制

1. **应用代码的内部逻辑** —— 如果一个类型定义比它保护的代码还复杂，那它是负债不是资产。
2. **团队没人能维护时** —— 你写的 `Extract<UnionToIntersection<F>, (...args: any) => any>` 六个月后你自己都看不懂。
3. **可以用简单方案替代时** —— 一个 `as const` 满足条件的话，不需要写 recursive conditional type。

## 判断标准

问自己一个问题：**如果我删掉这个类型，换成 `any`，会在什么场景下出 bug？**

如果答案是"很多地方"，这个类型是有价值的。如果答案是"可能不会出 bug"，你在炫技。
