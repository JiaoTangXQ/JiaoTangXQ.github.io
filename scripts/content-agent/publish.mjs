import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "./utils.mjs";

export async function writeContentFile({ projectRoot = process.cwd(), relativePath, markdown, force = false }) {
  const file = path.join(projectRoot, relativePath);
  if (!force && (await pathExists(file))) {
    throw new Error(`${relativePath} already exists. Use --force to overwrite.`);
  }
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, markdown, "utf8");
  return file;
}

export async function writeReviewArtifact({ projectRoot = process.cwd(), date, summaries, errors = [] }) {
  const file = path.join(projectRoot, ".cache/content-agent/reviews", `${date}.md`);
  await ensureDir(path.dirname(file));
  const body = `# 焦糖星球内容生产审核 ${date}

## 候选条目

${(summaries ?? [])
  .map(
    (item, index) => `${index + 1}. **${item.title}**  
   Score: ${item.aiScore ?? item.score ?? "n/a"}  
   Source: ${item.sourceUrl}  
   Reason: ${item.reason ?? item.scoreReason ?? "n/a"}`,
  )
  .join("\n\n")}

## 抓取错误

${errors.length ? errors.map((error) => `- ${error.sourceName ?? error.sourceId}: ${error.message}`).join("\n") : "- 无"}
`;
  await fs.writeFile(file, body, "utf8");
  return file;
}
