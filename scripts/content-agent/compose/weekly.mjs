import path from "node:path";
import { descriptionFrom, slugify, truncate, yamlArray, yamlString } from "../utils.mjs";

export function composeWeekly({ week, date, summaries, brand = "焦糖星球", draft = true } = {}) {
  const sorted = (summaries ?? []).slice().sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
  const title = `${brand} AI 深度信号周报 ${week.replace("-", " ")}`;
  const slug = `${date}-jiaotang-ai-signals-weekly-${week.toLowerCase()}`;
  const description = descriptionFrom(sorted, `${brand} AI 周报：从本周产品、研究、开源和行业信号里提炼趋势判断。`);
  const markdown = `${weeklyFrontmatter({ title, description, date, draft })}

# ${title}

> 这篇周报由 content-agent 汇总最近一周的日报信号后生成。它保留来源链路，但重新组织判断、标题和叙事。

## 🎯 Weekly Focus | 本周聚焦

${renderFocus(sorted)}

## 📡 Signals & Noise | 信号与噪音

${renderSignalList(sorted)}

## 📊 Macro & Trends | 宏观与趋势

${renderTrends(sorted, brand)}

## 🧰 The Toolbox | 开发者工具箱

${renderToolbox(sorted)}

## 🗳️ Things to Ponder | 思考题

1. 本周最值得继续跟踪的信号，是真能力变化，还是入口和叙事变化？
2. 哪些开源项目已经从“玩具”进入可复用工程模块？
3. 下周如果只验证一个判断，${brand}应该优先验证哪一个？
`;

  return {
    relativePath: path.posix.join("src/content/posts/weekly", `${slugify(slug)}.md`),
    markdown,
    title,
    description,
  };
}

function weeklyFrontmatter({ title, description, date, draft }) {
  return [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `date: ${yamlString(date)}`,
    `tags:${yamlArray(["AI周报", "AI资讯", "Agent", "开源"], "  ")}`,
    `pillar: "agent"`,
    `tier: "A"`,
    `draft: ${draft ? "true" : "false"}`,
    `lang: "zh"`,
    "---",
  ].join("\n");
}

function renderFocus(items) {
  return items
    .slice(0, 3)
    .map(
      (item, index) => `### ${index + 1}. ${item.title}

🔗 Sources: [${item.sourceName}](${item.sourceUrl})

${item.aiSummary}

📝 深度解读：${truncate(item.reason, 180)}`,
    )
    .join("\n\n");
}

function renderSignalList(items) {
  return items
    .slice(0, 12)
    .map((item) => `- **${item.title}**：${truncate(item.aiSummary, 120)} [source](${item.sourceUrl})`)
    .join("\n");
}

function renderTrends(items, brand) {
  const sections = new Set(items.map((item) => item.section));
  const tags = new Set(items.flatMap((item) => item.tags ?? []));
  return `${brand}本周看到 ${sections.size || 1} 条主线：产品入口、研究效率、开源工程和行业商业化正在互相挤压。高频标签包括 ${Array.from(tags).slice(0, 8).join(" / ") || "AI / Agent / 模型"}。接下来要看的不是单点发布，而是这些信号能否变成持续可用的工作流。`;
}

function renderToolbox(items) {
  const tools = items.filter((item) => item.section === "opensource").slice(0, 5);
  if (tools.length === 0) return "- 本周暂无足够开源工具信号，等待下一次抓取。";
  return tools.map((item) => `- [${item.title}](${item.sourceUrl})：${truncate(item.aiSummary, 100)}`).join("\n");
}
