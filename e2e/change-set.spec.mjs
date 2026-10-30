import { test, expect } from "@playwright/test";
import {
  seedChangeSet,
  changeSetSample,
  readChangeLibrary,
  fillAndPreview,
  approveContent,
} from "./change-set-fixture.mjs";
test("canonical package preview and cancel do not write or install proposed assets", async ({
  page,
}) => {
  await seedChangeSet(page);
  const before = await readChangeLibrary(page),
    input = await changeSetSample();
  await fillAndPreview(page, input);
  await expect(
    page.getByRole("heading", { name: "Change-set preview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply approved changes", exact: true }),
  ).toBeDisabled();
  expect(await readChangeLibrary(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  expect(await readChangeLibrary(page)).toEqual(before);
});
test("MIDORI creates exactly fifteen ordered shots,60seconds,types2/9/4 and pending4,then replays without duplication", async ({
  page,
}) => {
  await seedChangeSet(page);
  const before = await readChangeLibrary(page),
    input = await changeSetSample();
  await fillAndPreview(page, input);
  await approveContent(page);
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const after = await readChangeLibrary(page),
    receipt = after.preferences.aiImports.receipts[0],
    project = after.collections.find(
      (c) => c.id === receipt.idMappings.midori.id,
    ),
    shots = project.project.shots;
  expect(shots).toHaveLength(15);
  expect(shots.map((s) => s.order)).toEqual(
    Array.from({ length: 15 }, (_, i) => i),
  );
  expect(shots.map((s) => s.code)).toEqual(
    Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")),
  );
  expect(shots.reduce((n, s) => n + s.plannedDurationSeconds, 0)).toBe(60);
  expect(
    shots.filter((s) => s.plannedShotType === "character_scene"),
  ).toHaveLength(2);
  expect(
    shots.filter((s) => s.plannedShotType === "property_environment"),
  ).toHaveLength(9);
  expect(
    shots.filter((s) => s.plannedShotType === "graphic_motion"),
  ).toHaveLength(4);
  expect(shots.every((s) => s.status === "planned" && !s.selectedSceneId)).toBe(
    true,
  );
  expect(after.scenes).toHaveLength(before.scenes.length + 15);
  expect(after.assets).toEqual(before.assets);
  expect(after.media).toEqual(before.media);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.preferences.activeDraftId).toBe(
    before.preferences.activeDraftId,
  );
  expect(after.preferences.aiImports.candidates).toHaveLength(2);
  for (const op of input.operations.filter(
    (o) => o.type === "scene.create_direct_prompt",
  ))
    expect(
      after.scenes.find((s) => s.id === receipt.idMappings[op.clientRef].id)
        .outputs.full,
    ).toBe(op.prompt.text);
  expect(
    after.scenes
      .filter((s) => !before.scenes.some((b) => b.id === s.id))
      .reduce((n, s) => n + (s.pendingInputs?.length ?? 0), 0),
  ).toBe(4);
  await page
    .getByRole("button", { name: "Import another package", exact: true })
    .click();
  await page
    .getByLabel("Change-set JSON", { exact: true })
    .fill(JSON.stringify(input));
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await expect(page.getByText(/already applied/)).toBeVisible();
  expect(await readChangeLibrary(page)).toEqual(after);
});
