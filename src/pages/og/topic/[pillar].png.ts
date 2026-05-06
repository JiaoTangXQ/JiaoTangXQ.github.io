import type { APIRoute } from "astro";
import { generateBrandedOgPng } from "@/lib/og";
import { HUB_PILLARS, PILLARS, type PillarSlug } from "@/lib/pillars";

export async function getStaticPaths() {
  return HUB_PILLARS.map((slug) => ({ params: { pillar: slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.pillar as PillarSlug;
  const meta = PILLARS[slug];
  const png = await generateBrandedOgPng({
    label: `焦糖星球 · 主题`,
    title: meta.title,
    subtitle: meta.lede,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
