# 每日三题生成规范

每次刷新最后一步：基于过去 72 小时入库的新 items，选 3 组**立场对立或互补**的议题组合，写到 `public/data/daily.json`。这是用户打开焦糖星球首屏看到的 HUD。

## 目标

**强制异见同屏**。每个议题由 2-3 篇文章组成，每篇代表一个**不同的立场**。用户不用搜、不用选，一打开就看到一个争议的多面。

## 输入

```bash
# 过去 72 小时的 items
node -e "
const items = require('./content/external/items.json');
const cutoff = Date.now() - 72 * 3600 * 1000;
const fresh = items.filter(i => new Date(i.date).getTime() >= cutoff);
console.log('Fresh items:', fresh.length);
fresh.forEach(i => console.log(JSON.stringify({
  slug: i.slug,
  titleZh: i.titleZh,
  sourceName: i.sourceName,
  topics: i.topics,
  stance: i.stance,
  summary: i.summary?.slice(0, 80)
})));
"
```

## 选题流程

1. **聚类**：把新 items 按主题隐式分组（比如 AI 监管、巴勒斯坦、气候变化、青年就业、某个新闻事件）
2. **筛选可对立议题**：该议题里必须有 **至少 2 种立场**的 item
3. **选 top 3**：
   - 议题之间要有**主题多样性**（不能三个都是 AI）
   - 每个议题要有**中文 + 英文** mix（如果可能）
   - 避开纯技术细节话题，偏向有公共讨论价值的
4. **为每个议题给 2-3 个 view**：挑最能代表各立场的 slug

## 输出格式

严格 JSON，写到 `public/data/daily.json`：

```json
{
  "date": "2026-04-20",
  "intro": "今日三题 · 同一议题，三种立场并排看看",
  "topics": [
    {
      "id": "topic-slug-1",
      "question": "一句问句形式的议题",
      "subtitle": "一句话交代为什么值得看这三个立场的碰撞",
      "views": [
        {
          "slug": "ext-...",
          "stance": "4-6 字的立场标签",
          "color": "#ff6b6b"
        },
        {
          "slug": "ext-...",
          "stance": "4-6 字",
          "color": "#5cc8ff"
        },
        {
          "slug": "ext-...",
          "stance": "4-6 字",
          "color": "#47d98f"
        }
      ]
    }
  ]
}
```

- `date`：今天 YYYY-MM-DD
- `intro`：可以小改版以匹配当天议题氛围，也可保留默认
- `id`：议题的英文 slug（a-z0-9-），用于 React key
- `question`：中文问句，20 字内，有张力
- `subtitle`：中文陈述，30-50 字，说一句"为什么要看对立"
- `views[].stance`：4-6 字，一眼能看出这个角度（不是源名，是立场）
- `views[].color`：从下面调色板里选，同议题内三个颜色要有反差

### 调色板（每议题选 2-3 个，要反差明显）

| 色值 | 感觉 |
|---|---|
| `#ff6b6b` | 红 · 警告/批判/悲观 |
| `#ff8a66` | 橙 · 反思/质疑 |
| `#ffd166` | 黄 · 中立/观察 |
| `#47d98f` | 绿 · 建设性/乐观 |
| `#5cc8ff` | 蓝 · 理性/技术 |
| `#6daaff` | 浅蓝 · 主流/稳重 |
| `#b87aff` | 紫 · 第三视角/超然 |
| `#ff6b8a` | 粉红 · 人文关怀 |

## 好议题的判断标准

- **问句要有张力**：「AI 是未来还是泡沫？」✓；「关于 AI 的三篇文章」✗
- **立场要真正对立**：不能三篇都是主流批判 AI
- **避免假对立**：Simon Willison 和 Dwarkesh 虽然来自不同人，但都是技术乐观派——不算对立
- **时效性**：72h 窗口内，用户打开能感受到"这是今天真在发生的事"

## 一个完整例子

```json
{
  "date": "2026-04-20",
  "intro": "今日三题 · 同一议题，三种立场并排看看",
  "topics": [
    {
      "id": "ai-bubble-or-future",
      "question": "AI 是未来，还是泡沫？",
      "subtitle": "三个人看同一个行业，看到三种不同的真相。",
      "views": [
        { "slug": "ext-wheresyoured-the-subprime-ai-crisis-is-here", "stance": "泡沫将至", "color": "#ff6b6b" },
        { "slug": "ext-garymarcus-three-reasons-...", "stance": "别急着恐慌", "color": "#ffd166" },
        { "slug": "ext-dwarkesh-dylan-patel-deep-dive-...", "stance": "仍在扩张", "color": "#5cc8ff" }
      ]
    },
    {
      "id": "tech-reshapes-power",
      "question": "技术在重塑权力，朝哪个方向？",
      "subtitle": "当老板用监控砍工资时，另一边是公共基础设施和每日抵抗。",
      "views": [
        { "slug": "ext-pluralistic-your-boss-surveillance-...", "stance": "监控资本主义", "color": "#ff6b8a" },
        { "slug": "ext-anildash-defending-privacy-daily", "stance": "日常抵抗", "color": "#6daaff" },
        { "slug": "ext-pluralistic-switzerland-fiber", "stance": "公共方案", "color": "#47d98f" }
      ]
    },
    {
      "id": "work-meaning-2026",
      "question": "奋斗还是放下？",
      "subtitle": "一代人里，有人离场，有人坚持，有人看穿「逃离」也是陷阱。",
      "views": [
        { "slug": "ext-joanwestenberg-why-i-quit-the-strive", "stance": "我放弃奋斗", "color": "#ff8a66" },
        { "slug": "ext-anildash-actually-people-love-to-work-hard", "stance": "人就爱努力", "color": "#47d98f" },
        { "slug": "ext-joanwestenberg-passive-income-trap", "stance": "躺平也是陷阱", "color": "#b87aff" }
      ]
    }
  ]
}
```

## 不要做

- ❌ 选没 item 支持的"议题"（宁可少一个议题，不要瞎编）
- ❌ 选 72h 之外的旧 item（"鲜"是承诺）
- ❌ 三个议题都同一领域
- ❌ `stance` 写得像源名而不是立场（不要写"Ed Zitron 的观点"，写"泡沫将至"）
- ❌ 一个议题内两个 view 其实是同立场（比如都批判 AI）

## 如果 72h 内 item 不够

- 少于 10 条新 item：放宽到 7 天窗口
- 还是不够：用现有 items.json 里的老 item 应急，但在 intro 里声明"内容较少今日推荐"

## 输出完成后

告诉用户三题的 `question` 文本，方便记到 commit message 里。
