import readingTime from "reading-time";

export function formatDate(date: Date, lang: "zh" | "en" = "zh"): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (lang === "en") {
    const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return `${month} ${date.getUTCDate()}, ${y}`;
  }
  return `${y}.${m}.${d}`;
}

export function isoDate(date: Date): string {
  return date.toISOString();
}

export function estimateReadingMinutes(text: string): number {
  if (!text) return 1;
  const stats = readingTime(text, { wordsPerMinute: 300 });
  return Math.max(1, Math.ceil(stats.minutes));
}
