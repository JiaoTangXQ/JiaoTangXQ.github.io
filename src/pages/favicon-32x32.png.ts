import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const SVG_PATH = path.resolve("public/favicon.svg");

export const GET: APIRoute = async () => {
  const svg = fs.readFileSync(SVG_PATH, "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 32 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
