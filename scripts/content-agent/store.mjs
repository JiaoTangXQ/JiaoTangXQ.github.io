import path from "node:path";
import { ensureDir, readJson, writeJson } from "./utils.mjs";

export class JsonStore {
  constructor({ root = ".cache/content-agent" } = {}) {
    this.root = root;
  }

  artifactPath(date, type) {
    return path.join(this.root, "runs", date, `${type}.json`);
  }

  async writeRunArtifact(date, type, value) {
    await writeJson(this.artifactPath(date, type), {
      date,
      type,
      generatedAt: new Date().toISOString(),
      data: value,
    });
  }

  async readRunArtifact(date, type, fallback = null) {
    const payload = await readJson(this.artifactPath(date, type), null);
    return payload ? payload.data : fallback;
  }

  async listRunDates() {
    const dir = path.join(this.root, "runs");
    await ensureDir(dir);
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(dir, { withFileTypes: true }));
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  }
}
