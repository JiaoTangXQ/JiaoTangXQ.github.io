// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const SITE = "https://jiaotangxq.github.io";

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  integrations: [sitemap()],
});
