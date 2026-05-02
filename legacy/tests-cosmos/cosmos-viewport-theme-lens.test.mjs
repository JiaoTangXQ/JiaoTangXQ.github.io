import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("CosmosViewport no longer references ThemeLens", () => {
  const filePath = path.resolve("src/features/cosmos/components/CosmosViewport.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes('from "./ThemeLens"'), false);
  assert.equal(source.includes("<ThemeLens"), false);
});
