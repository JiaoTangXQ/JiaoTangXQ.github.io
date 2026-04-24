/**
 * 纯规则的质量打分（0-1）。不调用任何 LLM。
 *
 * 低分的典型模式：
 * - 正文过短（<200 字符）
 * - 标题 / 正文含占位符（Comments URL:, submitted by /u/…, Points: 1 # Comments: 0）
 * - 标题类型是快讯 / 早报 / 广播 / 预告 / 讣告 / 签到
 * - 正文纯链接
 */

import type { ExternalContentCandidate } from "../../../src/lib/content/types.js";
import { htmlToPlainText } from "./sanitizeContent.mjs";
import { getChinaPoliticalContentReason } from "./chinaPoliticsFilter.mjs";

type ScoredCandidate = {
  candidate: ExternalContentCandidate;
  score: number;
  reason?: string;
};

const JUNK_TITLE_PATTERNS: RegExp[] = [
  /快讯|早报|广播|晨报|夜报|周报|月报/,
  /预告|讣告|悼念|追思/,
  /签到|打卡|日常/,
  /open thread/i,
  /weekly round[- ]?up/i,
  /what are you (working|reading|playing) on/i,
];

const JUNK_EXCERPT_SUBSTRINGS = [
  "Comments URL:",
  "submitted by /u/",
  "Article URL:",
  "Points: 1 # Comments: 0",
  "Points: 2 # Comments: 0",
  "[link]",
  "[comments]",
];

/** Score a single candidate based on content-shape heuristics. */
export function scoreCandidate(candidate: ExternalContentCandidate): ScoredCandidate {
  let score = 0.7;
  const reasons: string[] = [];

  const plain = htmlToPlainText(candidate.rawExcerpt || "");
  const title = candidate.title || "";
  const chinaPoliticsReason = getChinaPoliticalContentReason(candidate);

  if (chinaPoliticsReason) {
    return {
      candidate,
      score: 0,
      reason: chinaPoliticsReason,
    };
  }

  // Length-based scoring
  if (plain.length < 80) {
    score -= 0.5;
    reasons.push(`excerpt 过短 ${plain.length}字`);
  } else if (plain.length < 200) {
    score -= 0.25;
    reasons.push("excerpt 偏短");
  } else if (plain.length > 1200) {
    score += 0.1;
  }

  // Title junk patterns
  for (const pat of JUNK_TITLE_PATTERNS) {
    if (pat.test(title)) {
      score -= 0.35;
      reasons.push(`标题含垃圾模式 /${pat.source}/`);
      break;
    }
  }

  // Excerpt junk substrings
  for (const junk of JUNK_EXCERPT_SUBSTRINGS) {
    if (plain.includes(junk)) {
      score -= 0.3;
      reasons.push(`正文含占位符 "${junk}"`);
      break;
    }
  }

  // HN Ask/Newest with only bot metadata and no body
  const hnLowSignal = /^Points: \d+ # Comments: \d+$/m.test(plain);
  if (hnLowSignal && plain.length < 300) {
    score -= 0.3;
    reasons.push("HN 无正文");
  }

  // Reddit-only-title posts (no text body)
  if (/^submitted by \/u\/\S+/.test(plain.trim()) && plain.length < 200) {
    score -= 0.4;
    reasons.push("Reddit 无正文");
  }

  // Missing URL
  if (!candidate.sourceUrl) {
    score -= 0.5;
    reasons.push("无 sourceUrl");
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));

  return {
    candidate,
    score,
    reason: reasons.length > 0 ? reasons.join("; ") : undefined,
  };
}

/** Apply scoring to all candidates, returning those with score >= threshold. */
export function filterByQuality(
  candidates: ExternalContentCandidate[],
  threshold = 0.45,
): { kept: ExternalContentCandidate[]; dropped: ScoredCandidate[] } {
  const scored = candidates.map(scoreCandidate);
  const kept: ExternalContentCandidate[] = [];
  const dropped: ScoredCandidate[] = [];
  for (const s of scored) {
    if (s.score >= threshold) kept.push(s.candidate);
    else dropped.push(s);
  }
  return { kept, dropped };
}
