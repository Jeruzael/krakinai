import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
// Repository-owned synthetic fixture only. Never executes a user-supplied file.
const input = new URL(
  "../src/__tests__/fixtures/changeSetFixture.ts",
  import.meta.url,
);
const js = ts.transpileModule(readFileSync(input, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const context = { exports: {} };
runInNewContext(js, context, { timeout: 1000 });
const directory = new URL("../docs/examples/", import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(
  new URL("midori-change-set-v1.json", directory),
  JSON.stringify(context.exports.midoriChangeSet(), null, 2) + "\n",
);
