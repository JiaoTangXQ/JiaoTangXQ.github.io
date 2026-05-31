import type { APIRoute } from "astro";

const DEFAULT_SITE = "http://121.40.108.230";

export const GET: APIRoute = ({ site }) => {
  const siteUrl = (site?.toString() || DEFAULT_SITE).replace(/\/$/, "");

  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${siteUrl}/sitemap-index.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
};
