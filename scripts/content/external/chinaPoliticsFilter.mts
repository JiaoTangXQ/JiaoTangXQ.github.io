import type {
  ExternalContentCandidate,
  ExternalContentRecord,
} from "../../../src/lib/content/types.js";
import { htmlToPlainText } from "./sanitizeContent.mjs";

type ContentLike = Partial<ExternalContentCandidate & ExternalContentRecord>;

const DIRECT_POLITICAL_PATTERNS: RegExp[] = [
  /\bxi jinping\b|\bpresident xi\b|习近平/i,
  /\bccp\b|\bcommunist party\b|中国共产党|中共|共产党/i,
  /\bmao['’]s legacy\b|\bmao zedong\b|毛泽东/i,
  /\bpla\b|people['’]s liberation army|解放军/i,
  /\btaiwan leader\b|\bwilliam lai\b|\blai ching-te\b|赖清德|两岸|台海/i,
  /\btibetan buddhists?\b|\btibet\b|西藏|藏传佛教/i,
  /\bxinjiang\b|\buyghur\b|新疆|维吾尔/i,
];

const CHINA_ENTITY_PATTERNS: RegExp[] = [
  /\bchina\b|\bchinese\b|\bbeijing\b|中国|中方|北京/i,
  /\btaiwan\b|\btaiwanese\b|台湾/i,
  /\bhong kong\b|香港/i,
];

const POLITICAL_CONTEXT_PATTERNS: RegExp[] = [
  /\bpolitics?\b|\bpolitical\b|\bgovernance\b|\bgovernment\b/i,
  /\bdiplomac(?:y|ies|tic)\b|\bforeign affairs?\b|\bforeign leaders?\b|\bsummit\b/i,
  /\bgeopolitic(?:s|al)?\b|\bsecurity\b|\bnational security\b/i,
  /\bmilitary\b|\bnavy\b|\bwarships?\b|\bmaritime\b|\bchokepoints?\b/i,
  /\bsanctions?\b|\btrade deal\b|\btariffs?\b/i,
  /\bsp(?:y|ies)\b|\bvisa\b|\bpropaganda\b|\bpsyops?\b/i,
  /\bstate media\b|\bparty mouthpiece\b/i,
  /政治|外交|外事|领导人|峰会|政府|治理|国家安全/i,
  /军事|军方|海军|军舰|战舰|制裁|关税|贸易协议/i,
  /间谍|签证|宣传|对华|中美|美中/i,
];

const CROSS_ENTITY_PATTERNS: RegExp[] = [
  /\b(?:u\.s\.|us|america|american|washington|trump)\b[\s\S]{0,120}\bchina\b/i,
  /\bchina\b[\s\S]{0,120}\b(?:u\.s\.|us|america|american|washington|trump)\b/i,
  /\b(?:eu|european union|finland|russia|japan|cambodia|africa|african|eswatini)\b[\s\S]{0,120}\b(?:china|beijing|taiwan)\b/i,
  /\b(?:china|beijing|taiwan)\b[\s\S]{0,120}\b(?:eu|european union|finland|russia|japan|cambodia|africa|african|eswatini)\b/i,
  /(?:美国|华盛顿|特朗普|欧盟|芬兰|俄罗斯|日本|柬埔寨|非洲)[\s\S]{0,80}(?:中国|北京|台湾)/i,
  /(?:中国|北京|台湾)[\s\S]{0,80}(?:美国|华盛顿|特朗普|欧盟|芬兰|俄罗斯|日本|柬埔寨|非洲)/i,
];

function normalizeRecordText(item: ContentLike): string {
  return [
    item.title,
    item.preview,
    item.sourceName,
    item.sourceDomain,
    item.sourceUrl,
    item.topics?.join(" "),
    item.rawExcerpt,
  ]
    .filter(Boolean)
    .map((part) => htmlToPlainText(String(part)))
    .join("\n");
}

function hasAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function getChinaPoliticalContentReason(
  item: ContentLike,
): string | undefined {
  const text = normalizeRecordText(item);
  if (!text.trim()) return undefined;

  if (hasAny(DIRECT_POLITICAL_PATTERNS, text)) {
    return "中国政治直接关键词";
  }

  const mentionsChinaEntity = hasAny(CHINA_ENTITY_PATTERNS, text);
  if (!mentionsChinaEntity) return undefined;

  if (hasAny(CROSS_ENTITY_PATTERNS, text) && hasAny(POLITICAL_CONTEXT_PATTERNS, text)) {
    return "中国相关国际政治/安全语境";
  }

  if (hasAny(POLITICAL_CONTEXT_PATTERNS, text)) {
    return "中国相关政治/治理语境";
  }

  return undefined;
}

export function isChinaPoliticalContent(item: ContentLike): boolean {
  return getChinaPoliticalContentReason(item) !== undefined;
}
