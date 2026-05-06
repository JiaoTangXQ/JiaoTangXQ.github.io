import type { APIRoute } from "astro";
import { generateBrandedOgPng } from "@/lib/og";

export const GET: APIRoute = async () => {
  const png = await generateBrandedOgPng({
    title: "焦糖星球",
    subtitle: "中文圈关于 AI 时代工程实践最值得读的写作站",
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
