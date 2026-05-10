import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export type Daily = CollectionEntry<"dailies">;

const byDateDesc = (a: Daily, b: Daily) => b.data.date.getTime() - a.data.date.getTime();

export async function getPublishedDailies(): Promise<Daily[]> {
  const dailies = await getCollection("dailies", ({ data }) => !data.draft);
  return dailies.sort(byDateDesc);
}

export async function getAllDailiesForBuild(): Promise<Daily[]> {
  const dailies = await getCollection("dailies");
  return dailies.sort(byDateDesc);
}

export function dailyMonth(daily: Daily): string {
  return daily.data.date.toISOString().slice(0, 7);
}

export function dailyDay(daily: Daily): string {
  return daily.data.date.toISOString().slice(0, 10);
}

export function dailyUrl(daily: Daily): string {
  return `/docs/${dailyMonth(daily)}/${dailyDay(daily)}/`;
}

export function dailyDisplayDate(daily: Daily): string {
  return daily.data.date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function groupDailiesByMonth(dailies: Daily[]): Array<{ month: string; dailies: Daily[] }> {
  const groups = new Map<string, Daily[]>();
  for (const daily of dailies) {
    const key = dailyMonth(daily);
    groups.set(key, [...(groups.get(key) ?? []), daily]);
  }
  return Array.from(groups.entries()).map(([month, groupedDailies]) => ({
    month,
    dailies: groupedDailies,
  }));
}
