// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const DEFAULT_SITE = "http://121.40.108.230";
const SITE = (process.env.SITE_URL || DEFAULT_SITE).replace(/\/$/, "");

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  integrations: [sitemap()],
});
