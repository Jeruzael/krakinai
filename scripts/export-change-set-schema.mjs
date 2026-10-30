import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
// Build tool: executes only the repository-owned data module, never imported JSON.
const input = new URL("../src/domain/changeSetSchema.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(input, "utf8"), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const context = { exports: {} };
runInNewContext(compiled, context, {
  timeout: 1000,
  filename: "repository-change-set-schema.js",
});
writeFileSync(
  new URL("../docs/change-set.schema.json", import.meta.url),
  JSON.stringify(context.exports.CHANGE_SET_SCHEMA, null, 2) + "\n",
);
