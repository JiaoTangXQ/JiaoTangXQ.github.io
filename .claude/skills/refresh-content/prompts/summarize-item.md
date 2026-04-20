# 单条内容摘要规范

对每条 candidate，产出以下 JSON 对象，写到 `content/external/pending-summaries/{slug}.json`。

## 输入字段

```jsonc
{
  "slug": "ext-joanwestenberg-time-is-a-user-interface",
  "title": "Time is a User Interface",         // 原文标题
  "rawExcerpt": "...",                          // RSS 抓到的原文片段（可能是全文，可能只有开头）
  "sourceName": "Joan Westenberg",
  "topics": ["技术", "思考"],                   // 源的默认 topics
  "sourceLanguage": "en",                       // 源语言
  "sourceStance": "independent"                 // 源默认立场
}
```

## 输出字段

```jsonc
{
  "slug": "ext-joanwestenberg-time-is-a-user-interface",  // 必填，和输入同
  "titleZh": "时间是一种用户界面",                           // 必填（源是 zh 时可省略）
  "summary": "80-150 字中文摘要。...",                      // 必填
  "whyWorthReading": "30-60 字中文，针对本文说的值得看的点", // 必填
  "topics": ["思考", "哲学"],                              // 可选：如源默认不准确，重写
  "contentCategory": "opinion",                            // 可选：research/analysis/opinion/tutorial/news/announcement/obituary/event
  "qualityScore": 0.82,                                   // 必填，0.0-1.0
  "stance": "independent",                                // 可选：看文章实际立场而非源立场
  "language": "zh"                                        // 可选：如摘要质量极低，可写入 zh 或 en
}
```

## 字段细则

### `titleZh`
- **不要翻译腔**。读着像中文编辑写的标题，不像机翻
- 15 字以内
- 专有名词保留英文：React、OpenAI、NASA、Redis 等
- 失败例：「介绍一种 Rust 中的新模式」  
- 成功例：「Rust 里那个让人头疼的 Pattern」

### `summary`
- 80-150 字，提炼核心信息让中文读者快速抓到文章说了什么
- 不要复读标题，不要废话开头（"本文介绍了..."/"作者谈论了..."）
- 有观点的文章：写明作者立场和核心论据
- 技术文：说清楚解决的问题和关键做法
- 新闻：what + why matters
- **绝对不允许直接翻译英文 RSS 前几句**——要理解后重写

### `whyWorthReading`
- 30-60 字，告诉中文读者**为什么花时间看这一篇**
- 不能是万能句式（"这是一篇深度好文"/"值得一读"）
- 要具体：说出这篇和同类有什么不同
- 成功例：「不是又一篇反对 AI 的檄文——作者把矛头对准了 VC 估值模型本身，从金融泡沫角度给了一个少见的切入点」

### `qualityScore`（0.0–1.0）

| 分数区间 | 类型 | 判断标准 |
|---|---|---|
| 0.9+ | 原创深度研究 | 独到见解、跨领域启发、长读 |
| 0.75–0.9 | 扎实分析/技术深潜 | 信息增量大，观点清晰 |
| 0.6–0.75 | 有用新闻/教程 | 信息准确但没有独到之处 |
| 0.5–0.6 | 边缘 | 基本只是个新闻条目或作者个人感悟 |
| <0.5 | 淘汰 | 人事任命、活动预告、广告软文、短新闻、重复信息 |

`scoreExternalItems` 会把 <0.6 的自动过滤掉，所以**写小分数别犹豫**。

### `stance`
根据**文章实际立场**推断，不是源的默认：

| stance | 含义 |
|---|---|
| `mainstream` | 主流媒体视角，符合大众共识 |
| `independent` | 独立视角，不迎合任何阵营 |
| `critical` | 对主流叙事的批判 |
| `progressive` | 左翼/进步主义 |
| `conservative` | 右翼/保守主义 |
| `academic` | 学术视角，严谨/中立 |
| `non-western` | 非西方（全球南方、东亚、俄语圈）|
| `speculative` | 思辨/推测/未来主义 |
| `technical` | 纯技术，无政治倾向 |
| `indie` | 独立作者/爱好者视角 |

### `topics`
从这 12 个里选 1-2 个最相关：  
`技术, AI, 科学, 社会, 文化, 历史, 哲学, 经济, 法律, 环境, 健康, 思考`

如果源默认 topics 不对就重写。比如 Paul Graham 的哲学随笔默认是"技术"，应该改 `["思考", "哲学"]`。

## 文件名

严格以 slug 命名：
```
content/external/pending-summaries/ext-simonwillison-gemma-4-audio-with-mlx.json
```

## 一个完整例子

输入：
```json
{
  "slug": "ext-joanwestenberg-why-i-quit-the-strive",
  "title": "Why I quit \"The Strive\"",
  "rawExcerpt": "For ten years I mistook being tired for being alive. I called it 'The Strive'...",
  "sourceName": "Joan Westenberg",
  "topics": ["技术", "社会"],
  "sourceLanguage": "en",
  "sourceStance": "independent"
}
```

输出写到 `content/external/pending-summaries/ext-joanwestenberg-why-i-quit-the-strive.json`：
```json
{
  "slug": "ext-joanwestenberg-why-i-quit-the-strive",
  "titleZh": "我为什么放弃「奋斗」",
  "summary": "Westenberg 把「奋斗」拆成了一种身份认同陷阱——十年里她把疲倦错当成活着的证据。放弃奋斗不是躺平，而是拒绝用「忙碌」来证明自己的存在价值。文章把矛头对准硅谷文化把劳动当美德的叙事，指出真正的问题不是工作太多，而是我们把自我价值和产出绑死了。",
  "whyWorthReading": "不是又一篇反奋斗檄文——作者区分了「停下奋斗」和「躺平」的差别，对理解当下反内卷情绪提供了一个更精确的定义",
  "topics": ["思考", "社会"],
  "contentCategory": "opinion",
  "qualityScore": 0.86,
  "stance": "critical"
}
```
