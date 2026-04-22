/**
 * 文章内容校验脚本
 * 在构建时检查所有文章的 frontmatter 质量，有 error 时阻断构建。
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ARTICLES_DIR = path.resolve("content/articles");
const KNOWN_TOPICS = [
  "技术", "AI", "思考", "骑行", "健身",
  "科学", "社会", "环境", "健康", "历史", "文化", "哲学", "经济", "法律",
  "工作台架构", "启动", "输入与路由", "主循环",
  "任务与分派", "治理与权限", "扩展系统", "远端与边界",
  "多Agent协作", "上下文管理", "终端界面", "外延执行",
  "工程美学", "参考",
];
const SLUG_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = ["title", "slug", "date", "topics"] as const;

let errorCount = 0;
let warnCount = 0;
let passCount = 0;

const files = fs.existsSync(ARTICLES_DIR)
  ? fs
      .readdirSync(ARTICLES_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()
  : [];

const slugsSeen = new Map<string, string>();

for (const file of files) {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
  const { data } = matter(raw);
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必填字段
  for (const field of REQUIRED_FIELDS) {
    const val = data[field];
    if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
      errors.push(`缺少必填字段 "${field}"`);
    }
  }

  // topics 必须是数组
  if (data.topics !== undefined && !Array.isArray(data.topics)) {
    errors.push(`topics 必须是数组`);
  }

  // slug 唯一性
  if (data.slug) {
    const existing = slugsSeen.get(data.slug);
    if (existing) {
      errors.push(`slug "${data.slug}" 与 ${existing} 重复`);
    } else {
      slugsSeen.set(data.slug, file);
    }
  }

  // slug 格式
  if (typeof data.slug === "string" && !SLUG_RE.test(data.slug)) {
    errors.push(`slug "${data.slug}" 格式不合法（仅允许小写字母、数字、连字符）`);
  }

  // 日期格式（gray-matter 会将 YYYY-MM-DD 自动解析为 Date 对象）
  if (data.date !== undefined) {
    if (data.date instanceof Date) {
      if (isNaN(data.date.getTime())) {
        errors.push(`日期无效`);
      }
    } else {
      const ds = String(data.date);
      if (!DATE_RE.test(ds) || isNaN(new Date(ds).getTime())) {
        errors.push(`日期 "${ds}" 格式不合法（需要 YYYY-MM-DD）`);
      }
    }
  }

  // 主题合法性（warning）
  if (Array.isArray(data.topics)) {
    for (const t of data.topics) {
      if (!KNOWN_TOPICS.includes(t)) {
        warnings.push(`主题 "${t}" 不在已知主题列表中`);
      }
    }
  }

  // importance 范围
  if (data.importance !== undefined) {
    const imp = Number(data.importance);
    if (isNaN(imp) || imp < 0.5 || imp > 2.0) {
      errors.push(`importance ${data.importance} 超出范围（0.5-2.0）`);
    }
  }

  // 输出结果
  for (const e of errors) console.log(`✗ ${file} — error: ${e}`);
  for (const w of warnings) console.log(`⚠ ${file} — warning: ${w}`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ ${file} — OK`);
  }

  errorCount += errors.length;
  warnCount += warnings.length;
  if (errors.length === 0) passCount++;
}

console.log(
  `\n校验完成：${files.length} 篇文章，${passCount} 通过，${warnCount} 警告，${errorCount} 错误`,
);

if (errorCount > 0) {
  process.exit(1);
}
