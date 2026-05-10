import fs from "node:fs/promises";
import path from "node:path";
import { fetchSignals } from "./fetch-signals.mjs";
import { rewriteSignals } from "./rewrite.mjs";

const args = new Set(process.argv.slice(2));
const date = argValue("--date") ?? new Date().toISOString().slice(0, 10);
const publish = args.has("--publish");
const force = args.has("--force");
const limit = Number.parseInt(argValue("--limit") ?? "9", 10);
const outFile = path.join(process.cwd(), "src/content/dailies", `${date}.mdx`);

const exists = await fileExists(outFile);
if (exists && !force) {
  console.log(`${path.relative(process.cwd(), outFile)} already exists. Use --force to regenerate it.`);
  process.exit(0);
}

const payload = await fetchSignals({ limit });
const daily = rewriteSignals(payload, { date, limit });
daily.draft = !publish;

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, renderDaily(daily, payload), "utf8");

console.log(`Generated ${path.relative(process.cwd(), outFile)} (${daily.draft ? "draft" : "published"}).`);
for (const error of payload.errors) {
  console.warn(`Skipped ${error.source}: ${error.message}`);
}

function renderDaily(daily, payload) {
  return `${frontmatter(daily)}

本日报由 \`scripts/ai-daily\` 从公开原始信源抓取候选条目后生成，默认以草稿保存。发布前请人工核对来源链接、事实表述和中文标题。

生成时间：${payload.generatedAt}
`;
}

function frontmatter(daily) {
  const lines = [
    "---",
    `title: ${yamlString(daily.title)}`,
    `description: ${yamlString(daily.description)}`,
    `date: ${daily.date}`,
    `draft: ${daily.draft ? "true" : "false"}`,
    "sections:",
  ];

  for (const section of daily.sections) {
    lines.push(`  - title: ${yamlString(section.title)}`);
    lines.push("    items:");
    for (const item of section.items) {
      lines.push(`      - title: ${yamlString(item.title)}`);
      lines.push(`        summary: ${yamlString(item.summary)}`);
      if (item.whyItMatters) {
        lines.push(`        whyItMatters: ${yamlString(item.whyItMatters)}`);
      }
      lines.push(`        sourceName: ${yamlString(item.sourceName)}`);
      lines.push(`        sourceUrl: ${yamlString(item.sourceUrl)}`);
      lines.push("        tags:");
      for (const tag of item.tags) {
        lines.push(`          - ${yamlString(tag)}`);
      }
    }
  }

  lines.push("---");
  return lines.join("\n");
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function argValue(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
