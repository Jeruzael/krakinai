import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
// Executes trusted repository modules/catalogs only, never uploaded packages.
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null },
  appType: "custom",
});
try {
  const schemas = await server.ssrLoadModule("/src/domain/changeSetSchema.ts");
  for (const [file, key] of [
    ["change-set.schema.json", "CHANGE_SET_SCHEMA"],
    ["change-set-v2.schema.json", "CHANGE_SET_V2_SCHEMA"],
    ['change-set-v3.schema.json','CHANGE_SET_V3_SCHEMA'],
    ['change-set-v4.schema.json','CHANGE_SET_V4_SCHEMA'],
  ]) {
    const path = new URL("../docs/" + file, import.meta.url),
      text = JSON.stringify(schemas[key], null, 2) + "\n";
    const legacyMatches =
      file === "change-set.schema.json" &&
      JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) ===
        JSON.stringify(schemas[key]);
    if (process.argv.includes("--check")) {
      if (
        !legacyMatches &&
        readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== text
      )
        throw Error("Stale schema: " + file);
    } else if (file === "change-set.schema.json"||file==='change-set-v2.schema.json'||file==='change-set-v3.schema.json') {
      if (JSON.stringify(JSON.parse(readFileSync(path,'utf8')))!==JSON.stringify(schemas[key]))
        throw Error('The v1/v2 schemas are frozen; do not rewrite them.');
    } else writeFileSync(path, text);
  }
} finally {
  await server.close();
}
