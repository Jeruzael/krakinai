import { test, expect } from "@playwright/test";
import {
  seedChangeSet,
  changeSetSample,
  readChangeLibrary,
  fillAndPreview,
  approveContent,
} from "./change-set-fixture.mjs";
test("deferred candidate review after reload exposes exact content before creating one unreviewed asset", async ({
  page,
}) => {
  await seedChangeSet(page);
  await fillAndPreview(page, await changeSetSample());
  await approveContent(page);
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const before = await readChangeLibrary(page),
    candidate = before.preferences.aiImports.candidates[0];
  await page.reload();
  await page
    .getByText("Pending library candidates (2)", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Review candidate " + candidate.title,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Change-set preview", exact: true }),
  ).toBeVisible();
  await page
    .locator(".import-operations summary")
    .filter({ hasText: /^Reusable candidates / })
    .click();
  await page
    .getByRole("button", { name: "Review review-candidate", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Proposed prompt review-candidate",
      exact: true,
    }),
  ).toHaveValue(candidate.promptText.replace(/\r\n/g, "\n"));
  await page
    .getByText("Resolved record and media metadata", { exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(candidate.description);
  await page
    .getByRole("button", { name: "Close operation", exact: true })
    .click();
  expect(await readChangeLibrary(page)).toEqual(before);
  await page.getByText("Reusable asset decisions (1)", { exact: true }).click();
  await page
    .getByRole("combobox", {
      name: "Decision for review-candidate",
      exact: true,
    })
    .selectOption("create");
  const duplicate = page.getByLabel(
    "Create separate asset despite matches (review-candidate)",
    { exact: true },
  );
  if (await duplicate.count()) await duplicate.check();
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const after = await readChangeLibrary(page),
    created = after.assets.find(
      (a) => !before.assets.some((b) => b.id === a.id),
    );
  expect(created).toMatchObject({
    promptText: candidate.promptText,
    reviewStatus: "unreviewed",
  });
  expect(after.assets).toHaveLength(before.assets.length + 1);
  for (const old of before.assets)
    expect(after.assets.find((a) => a.id === old.id)).toEqual(old);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.preferences.aiImports.receipts).toHaveLength(2);
});
