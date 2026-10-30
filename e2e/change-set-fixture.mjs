import {
  seedDirectPrompt,
  readDirectLibrary,
} from "./direct-prompt-fixture.mjs";
import { readFile } from "node:fs/promises";
export async function changeSetSample() {
  return JSON.parse(
    await readFile(
      new URL("../docs/examples/midori-change-set-v1.json", import.meta.url),
      "utf8",
    ),
  );
}
export async function seedChangeSet(page) {
  const ids = await seedDirectPrompt(page, {
    saved: true,
    project: true,
    reference: true,
  });
  await page.evaluate(async () => {
    const db = await import("/src/storage/db.ts"),
      fixture = await import("/src/__tests__/fixtures/changeSetFixture.ts");
    const connection = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = connection.transaction("assets", "readwrite");
      tx.objectStore("assets").put(fixture.syntheticCamera());
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  });
  await page.reload();
  return ids;
}
export const readChangeLibrary = readDirectLibrary;
export async function fillAndPreview(page, input) {
  await page.goto("/#/imports/ai");
  for (const name of ["Import another package", "Edit JSON"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.count()) await button.click();
  }
  await page
    .getByRole("textbox", { name: "Change-set JSON", exact: true })
    .fill(JSON.stringify(input, null, 2));
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Change-set preview", exact: true })
    .waitFor();
}
export async function approveContent(page) {
  await page.getByLabel("Approve storyboard changes", { exact: true }).check();
  await page
    .getByLabel("Approve new immutable scenes", { exact: true })
    .check();
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
}
