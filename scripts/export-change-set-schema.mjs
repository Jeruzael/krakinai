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
    } else if (file === "change-set.schema.json") {
      if (!legacyMatches)
        throw Error("The v1 schema is frozen; do not rewrite it.");
    } else writeFileSync(path, text);
  }
} finally {
  await server.close();
}
