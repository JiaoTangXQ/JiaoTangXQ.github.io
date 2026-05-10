#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs/promises";
import { fetchSources } from "./adapters/index.mjs";
import { composeDaily } from "./compose/daily.mjs";
import { composeWeekly } from "./compose/weekly.mjs";
import { loadConfig } from "./config.mjs";
import { createAIProvider } from "./ai/provider.mjs";
import { readRecentDailySourceUrls } from "./daily-history.mjs";
import { localizeSummaryMedia } from "./media-assets.mjs";
import { writeContentFile, writeReviewArtifact } from "./publish.mjs";
import { classifySignal, normalizeSignals, scoreSignals, selectCoreSignals } from "./score.mjs";
import { JsonStore } from "./store.mjs";
import { dateRangeForWeek, parseArgs } from "./utils.mjs";
import { summarizeSignals } from "./summarize.mjs";

const args = parseArgs();
const command = args._[0] ?? "run";
const projectRoot = process.cwd();
const config = await loadConfig({ projectRoot, cliArgs: args });
const store = new JsonStore({ root: path.join(projectRoot, config.cacheDir) });
const provider = createAIProvider(config.ai);
const date = args.date || new Date().toISOString().slice(0, 10);

try {
  switch (command) {
    case "ingest":
      await ingest();
      break;
    case "summarize":
      await summarize();
      break;
    case "daily":
      await daily();
      break;
    case "weekly":
      await weekly();
      break;
    case "review":
      await review();
      break;
    case "publish":
      await daily({ publish: true });
      break;
    case "run":
      await run();
      break;
    default:
      usage();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(`[content-agent] ${error.message}`);
  process.exitCode = 1;
}

async function ingest() {
  const { signals, errors } = await fetchSources(config.sources, { provider, date });
  const normalized = normalizeSignals(signals);
  const scored = scoreSignals(normalized, {
    now: `${date}T23:59:59.000Z`,
    sourceWeights: config.scoring.sourceWeights,
  });
  const excludeUrls = await readRecentDailySourceUrls({
    projectRoot,
    dailiesDir: config.output.dailiesDir,
    date,
    days: Number(config.scoring.dailyDedupeLookbackDays ?? 7),
  });
  const selected = selectCoreSignals(scored, {
    limit: Number(args.limit ?? 96),
    now: `${date}T23:59:59.000Z`,
    excludeUrls,
    ...(config.scoring.coreSelection ?? {}),
  });
  await store.writeRunArtifact(date, "signals", selected);
  await store.writeRunArtifact(date, "errors", errors);
  console.log(`[content-agent] ingested ${selected.length} signals (${errors.length} errors)`);
}

async function summarize() {
  const signals = await store.readRunArtifact(date, "signals", []);
  if (!signals.length) throw new Error(`No signals for ${date}; run ingest first.`);
  const summaries = await summarizeSignals(signals, {
    provider,
    brand: config.brand,
    limit: Number(args.limit ?? 36),
  });
  await store.writeRunArtifact(date, "summaries", summaries);
  console.log(`[content-agent] summarized ${summaries.length} signals`);
}

async function daily(options = {}) {
  const cachedSummaries = await store.readRunArtifact(date, "summaries", []);
  if (!cachedSummaries.length) throw new Error(`No summaries for ${date}; run summarize first.`);
  const summaries = await prepareDailySummaries(cachedSummaries);
  const artifact = composeDaily({
    date,
    summaries,
    brand: config.brand,
    draft: !(args.publish || options.publish),
  });
  const output = await writeContentFile({
    projectRoot,
    relativePath: artifact.relativePath,
    markdown: artifact.markdown,
    force: Boolean(args.force),
  });
  await store.writeRunArtifact(date, "daily", artifact);
  console.log(`[content-agent] wrote ${path.relative(projectRoot, output)}`);
}

async function prepareDailySummaries(summaries) {
  if (config.media?.localize === false) return summaries;
  const result = await localizeSummaryMedia(summaries, {
    projectRoot,
    date,
    ...(config.media ?? {}),
  });
  await store.writeRunArtifact(date, "summaries", result.summaries);
  const { downloaded, reused, failed, skipped } = result.stats;
  if (downloaded || reused || failed || skipped) {
    console.log(
      `[content-agent] media localized downloaded=${downloaded} reused=${reused} failed=${failed} skipped=${skipped}`,
    );
  }
  return result.summaries;
}

async function weekly() {
  const week = args.week || isoWeek(date);
  const dates = args.from && args.to ? dateRange(args.from, args.to) : dateRangeForWeek(week, date);
  const summaries = await loadSummariesForDates(dates);
  if (!summaries.length) throw new Error(`No summaries found for ${week}.`);
  const artifact = composeWeekly({
    week,
    date: args.weekDate || date,
    summaries,
    brand: config.brand,
    draft: !args.publish,
  });
  const output = await writeContentFile({
    projectRoot,
    relativePath: artifact.relativePath,
    markdown: artifact.markdown,
    force: Boolean(args.force),
  });
  await store.writeRunArtifact(date, "weekly", artifact);
  console.log(`[content-agent] wrote ${path.relative(projectRoot, output)}`);
}

async function review() {
  const summaries = await store.readRunArtifact(date, "summaries", []);
  const errors = await store.readRunArtifact(date, "errors", []);
  const output = await writeReviewArtifact({ projectRoot, date, summaries, errors });
  console.log(`[content-agent] wrote ${path.relative(projectRoot, output)}`);
}

async function run() {
  await ingest();
  await summarize();
  await review();
  await daily();
  if (args.weekly) await weekly();
}

function usage() {
  console.log(`Usage:
  npm run agent:ingest -- --date=YYYY-MM-DD
  npm run agent:summarize -- --date=YYYY-MM-DD
  npm run agent:daily -- --date=YYYY-MM-DD [--publish] [--force]
  npm run agent:weekly -- --week=YYYY-Www [--publish] [--force]
  npm run agent:run -- --date=YYYY-MM-DD [--publish] [--weekly]
`);
}

function isoWeek(dateString) {
  const value = new Date(`${dateString}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value - yearStart) / 86_400_000 + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function dateRange(from, to) {
  const out = [];
  const current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (current <= end) {
    out.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

export { classifySignal };

async function loadSummariesForDates(dates) {
  const summaries = [];
  for (const runDate of dates) {
    const cached = await store.readRunArtifact(runDate, "summaries", []);
    if (cached.length) {
      summaries.push(...cached);
      continue;
    }
    summaries.push(...(await readGeneratedDailySummaries(runDate)));
  }
  return summaries;
}

async function readGeneratedDailySummaries(runDate) {
  const file = path.join(projectRoot, config.output.dailiesDir, `${runDate}.md`);
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const summaries = [];
  let section = "industry";
  let current = null;
  let readingTags = false;
  for (const line of frontmatter.split("\n")) {
    const sectionMatch = line.match(/^  - title: "(.+)"$/);
    if (sectionMatch) {
      section = sectionKeyFromTitle(JSON.parse(`"${sectionMatch[1]}"`));
      readingTags = false;
      continue;
    }
    const itemMatch = line.match(/^      - title: (.+)$/);
    if (itemMatch) {
      current = {
        id: `${runDate}:${summaries.length + 1}`,
        title: JSON.parse(itemMatch[1]),
        section,
        tags: [],
        aiScore: 70,
      };
      summaries.push(current);
      readingTags = false;
      continue;
    }
    if (!current) continue;
    const field = line.match(/^        (summary|whyItMatters|sourceName|sourceUrl): (.+)$/);
    if (field) {
      const key = field[1] === "summary" ? "aiSummary" : field[1] === "whyItMatters" ? "reason" : field[1];
      current[key] = JSON.parse(field[2]);
      readingTags = false;
      continue;
    }
    if (line.match(/^        tags:/)) {
      readingTags = true;
      continue;
    }
    const tag = readingTags ? line.match(/^          - (.+)$/) : null;
    if (tag) current.tags.push(JSON.parse(tag[1]));
  }
  return summaries.filter((item) => item.sourceUrl);
}

function sectionKeyFromTitle(title) {
  const entries = Object.entries({
    product: "产品与功能更新",
    research: "前沿研究",
    opensource: "开源TOP项目",
    industry: "行业展望与社会影响",
    social: "社媒分享",
  });
  return entries.find(([, value]) => value === title)?.[0] ?? "industry";
}
