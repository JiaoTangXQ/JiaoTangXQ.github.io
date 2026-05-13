export function formatDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00+08:00`) : date;
  return value.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
