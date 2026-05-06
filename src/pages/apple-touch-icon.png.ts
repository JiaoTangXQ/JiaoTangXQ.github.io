import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const SVG_PATH = path.resolve("public/favicon.svg");

export const GET: APIRoute = async () => {
  const svg = fs.readFileSync(SVG_PATH, "utf8");
  // Apple touch icon: 180x180. 但我们的 favicon.svg 设计是深色圆角 + 焦糖色行星，
  // 在 iOS 主屏作为 app 图标时已经是放大显示，无需额外背景填充。
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 180 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
