---
title: "Claude Code hooks 机制地图"
slug: "018-hooks"
date: 2026-04-09
topics: [参考]
summary: "Claude Code 的 hooks 不是“执行几条 shell 脚本”那么简单。代码里能看到 command、prompt、agent、http、function 等多种 hook 形态，这说明它..."
importance: 0.9
---

# Claude Code hooks 机制地图

## 先说结论：hooks 在这里不是脚本口子，而是受控插桩总线

Claude Code 的 hooks 不是“执行几条 shell 脚本”那么简单。代码里能看到 command、prompt、agent、http、function 等多种 hook 形态，这说明它已经把 hook 当成正式运行时机制，而不是附送扩展点。

## 第一层：hook 覆盖的是生命周期，不是单一事件

### 实现链

hook 入口覆盖了工具前后、会话开始/结束、prompt 提交、stop、compact、subagent、permission、task 等关键时刻。

### 普通做法

更普通的 hook 系统往往只在少数固定动作前后留两个入口。

### 为什么不用

Claude Code 面对的是整条 agent 生命周期。要让团队、插件、企业策略真正接管关键行为，hook 必须覆盖一整条工作流，而不是只挂在边角。

### 代价

事件种类和调度面都会大幅膨胀；但扩展能力也更完整。

## 第二层：hook 执行后端不只一种

### 实现链

hook 可以是：

1. `command`
2. `prompt`
3. `agent`
4. `http`
5. `function`

### 普通做法

很多系统只支持 shell hook，或者只支持内存回调。

### 为什么不用

Claude Code 承认有些规则适合脚本，有些适合小模型，有些适合受限子 agent，有些适合 HTTP 集成。它不想用单一后端去硬装所有场景。

### 代价

hook 执行层会明显更复杂；但适配性更强。

## 第三层：hook 先服从信任边界，再谈执行

### 实现链

交互模式下，hooks 会受工作区信任状态约束；配置还会先做快照和来源治理。

### 普通做法

更省事的做法是：配置里写了 hook，就直接执行。

### 为什么不用

Claude Code 很清楚 hook 本质上就是“允许外部配置驱动代码执行”。如果不先看信任边界和来源等级，等于把任意执行能力交给不可信工作区。

### 代价

hook 会显得不那么“顺手”，也更容易碰到制度门槛；但安全口径更正。

## 第四层：managed hooks 和快照说明它在做治理，不只是做扩展

### 实现链

`hooksConfigSnapshot`、managed-only 策略、policy 控制等逻辑说明 hook 不是扁平平等的，某些来源拥有更高治理地位。

### 普通做法

普通扩展系统往往默认所有 hook 配置地位相同。

### 为什么不用

Claude Code 不只是在服务个人用户，还在考虑项目、插件和企业策略共存的现实。谁有资格定义 hook，本身就是治理问题。

### 代价

系统会多出来源优先级和快照刷新复杂度；但这比“一锅平权”更适合真实组织环境。

## 第五层：`agent hook` 说明 hooks 也能长成受限验证器

### 实现链

某些 hook 并不是一次轻量判断，而是可以启动一个受限子 agent，在小模型、有限回合数和受控工具集下做检查。

### 普通做法

更容易想到的做法是：hook 只跑脚本，别碰 agent。

### 为什么不用

Claude Code 面对的有些验证任务并不适合简单脚本，但又不值得让主 agent 自己承担。受限 agent hook 恰好填补了这个空位。

### 代价

hook 系统会从“脚本扩展点”升级为“流程型验证层”，复杂度明显上升；但能力也随之升级。

## 第六层：HTTP hook 的安全设计说明它不是天真开放

### 实现链

URL allowlist、header 处理、SSRF 防护、代理策略配合，这些都说明 HTTP hook 被认真包了起来。

### 普通做法

很多系统支持 HTTP webhook 时，只要能发请求就算完成。

### 为什么不用

Claude Code 不能允许 hook 成为数据外流或内网打点的暗门，所以它继续在网络层做了制度化约束。

### 代价

HTTP hook 配置更麻烦，也更受约束；但这是把 hook 放进生产环境的代价。
