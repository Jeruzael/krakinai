import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  isolatedMcpBrowser,
  sdkBridge,
  pairSynthetic,
  selectMcpRecord,
  setMcpFlag,
  showMcpProposals,
  approveMcpContent,
  nativeWindowDecision,
  enterPairingKey,
  applyMcpPermissions,
} from "./local-mcp-fixture.mjs";
import {
  seedRecipeBrowser,
  browserRecipe,
  candidateRecipe,
  readRecipeLibrary,
  readRecipeEvidence,
  beginWriteObservation,
  observedWrites,
  openRecipeOperation,
} from "./recipe-change-set-fixture.mjs";
const evidence = async (name, value) => {
  await mkdir("qa-results/local-mcp", { recursive: true });
  await writeFile(
    `qa-results/local-mcp/recipe-b1-${name}.json`,
    JSON.stringify(value, null, 2),
  );
};
async function configure(page, { allAssets = true } = {}) {
  await page.goto("/#/connections/ai");
  await setMcpFlag(page, "Allow change-set proposals", true);
  await selectMcpRecord(page, "Projects", "Synthetic MIDORI recipe project");
  for (const name of allAssets
    ? [
        "Synthetic Courtyard · environments",
        "Synthetic Greeting · actions",
        "Synthetic Mika / Base Identity · characters",
        "Synthetic Static Camera · camera",
      ]
    : ["Synthetic Static Camera · camera"])
    await selectMcpRecord(page, "Reusable assets", name);
}
async function pairNative(page, bridge, origin) {
  await applyMcpPermissions(page);
  await page.getByRole("tab", { name: "Connection", exact: true }).click();
  await page
    .getByLabel("Local bridge address", { exact: true })
    .fill(`http://127.0.0.1:${bridge.port}`);
  await page
    .getByRole("button", { name: "Connect Codex", exact: true })
    .click();
  const code = await page.locator(".ai-verification").textContent(),
    native = await nativeWindowDecision({
      pid: bridge.child.pid,
      entry: bridge.entry,
      port: bridge.port,
      code,
      origin,
    });
  expect(native.verified && native.allowed).toBe(true);
  await enterPairingKey(page, native.secret);
  expect(bridge.diagnosticsContain(native.secret)).toBe(false);
  native.secret = "";
  await page
    .getByRole("button", { name: "Confirm pairing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Disconnect Codex", exact: true }),
  ).toBeVisible();
}
for (const mode of [
  { name: "sdk-existing", origin: "http://127.0.0.1:4173", native: false },
  { name: "signed-native-ipv4", origin: "http://127.0.0.1:4173", native: true },
  {
    name: "signed-native-localhost",
    origin: "http://localhost:4173",
    native: true,
  },
])
  test(`B1 ${mode.name}: actual SDK preview, browser approval, receipt, replay and revocation`, async () => {
    test.skip(
      mode.native &&
        (process.platform !== "win32" ||
          process.env.KRAKINAI_NATIVE_QA !== "1"),
      "Opt-in real Valid signed Windows helper/driver; synthetic profiles only.",
    );
    test.setTimeout(120000);
    const { page, context } = await isolatedMcpBrowser(
        { width: 1440, height: 900 },
        1,
        mode.origin,
      ),
      bridge = await sdkBridge({
        production: mode.native,
        origin: mode.origin,
      });
    try {
      const ids = await seedRecipeBrowser(page),
        before = await readRecipeLibrary(page),
        input = browserRecipe(ids, {
          character: true,
          id: "synthetic-" + mode.name,
        }),
        hashes = (await readRecipeEvidence(page)).mediaHashes;
      expect(await page.evaluate(() => location.origin)).toBe(mode.origin);
      const other = await context.newPage();
      await other.goto(
        (mode.origin.includes("localhost")
          ? "http://127.0.0.1:4173"
          : "http://localhost:4173") + "/#/",
      );
      const separate = await other.evaluate(async () => {
        const s = await (await import("/src/storage/db.ts")).getAllSnapshot();
        return {
          s: s.scenes.length,
          a: s.assets.length,
          p: s.collections.length,
        };
      });
      expect(separate).toEqual({ s: 0, a: 0, p: 0 });
      await other.close();
      await configure(page);
      if (mode.native) await pairNative(page, bridge, mode.origin);
      else await pairSynthetic(page, bridge);
      await beginWriteObservation(page);
      const tools = await bridge.client.listTools(),
        schema = tools.tools.find(
          (t) => t.name === "krakinai_submit_change_set",
        ).inputSchema.properties.changeSet;
      expect(schema.oneOf.map((v) => v.properties.schema.const)).toEqual([
        "krakinai.change-set.v1",
        "krakinai.change-set.v2",
        "krakinai.change-set.v3",
        "krakinai.change-set.v4",
      ]);
      const preview = await bridge.call("krakinai_preview_change_set", {
        changeSet: input,
      });
      expect(preview.ok).toBe(true);
      const submitted = await bridge.call("krakinai_submit_change_set", {
        changeSet: input,
      });
      expect(submitted).toMatchObject({
        ok: true,
        data: { status: "review_required" },
      });
      expect(JSON.stringify([preview, submitted])).not.toContain(
        "PRIVATE_B1_IDENTITY_SENTINEL",
      );
      expect(await observedWrites(page)).toEqual([]);
      expect(await readRecipeLibrary(page)).toEqual(before);
      await showMcpProposals(page);
      await page
        .getByRole("button", { name: "Review proposal", exact: true })
        .click();
      await openRecipeOperation(page);
      const expectedFull = await page
        .getByRole("textbox", { name: "Recipe Full output recipe" })
        .inputValue();
      expect(expectedFull).toContain("PRIVATE_B1_IDENTITY_SENTINEL");
      await page
        .getByRole("button", { name: "Close operation", exact: true })
        .click();
      expect(await observedWrites(page)).toEqual([]);
      await approveMcpContent(page);
      const after = await readRecipeLibrary(page),
        receipt = after.preferences.aiImports.receipts.find(
          (r) => r.changeSetId === input.changeSetId,
        ),
        scene = after.scenes.find((s) => s.id === receipt.idMappings.recipe.id);
      expect(scene.authoringMode).toBe("recipe");
      expect(scene.outputs.full).toBe(expectedFull);
      expect(Object.keys(scene.outputs).sort()).toEqual([
        "compact",
        "full",
        "structured",
      ]);
      expect(scene.slots.character.sourceId).toBe("character");
      expect(scene.slots.environment.sourceRevision).toBe(2);
      expect(scene.sourceDraftId).toBeUndefined();
      expect(after.scenes.find((s) => s.id === ids.oldSceneId)).toEqual(
        before.scenes[0],
      );
      expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
        ids.oldSceneId,
      );
      expect(after.assets).toEqual(before.assets);
      expect(after.drafts).toEqual(before.drafts);
      expect((await readRecipeEvidence(page)).mediaHashes).toEqual(hashes);
      const status = await bridge.call("krakinai_get_proposal_status", {
        proposalId: submitted.data.proposalId,
      });
      expect(status.data.receipt.idMappings.recipe.id).toBe(scene.id);
      const confirmed = await bridge.call("krakinai_get_import_receipt", {
        changeSetId: receipt.changeSetId,
        packageDigest: receipt.packageDigest,
      });
      expect(confirmed.data.idMappings.recipe.id).toBe(scene.id);
      expect(JSON.stringify([status, confirmed])).not.toContain(
        "PRIVATE_B1_IDENTITY_SENTINEL",
      );
      const retry = await bridge.call("krakinai_submit_change_set", {
        changeSet: input,
      });
      expect(retry.data.proposalId).toBe(submitted.data.proposalId);
      expect(await readRecipeLibrary(page)).toEqual(after);
      expect(
        (
          await bridge.call("krakinai_get_generation_prompt", {
            sceneId: scene.id,
          })
        ).ok,
      ).toBe(false);
      await page.getByRole("tab", { name: "Connection", exact: true }).click();
      await page
        .getByRole("button", { name: "Disconnect Codex", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Disconnect Codex?", exact: true })
        .getByRole("button", { name: "Disconnect now", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: /^Disconnected$/ }),
      ).toBeVisible();
      expect(await bridge.call("krakinai_connection_status")).toMatchObject({
        ok: true,
        data: { connected: false },
      });
      expect(await bridge.call("krakinai_list_projects")).toMatchObject({
        ok: false,
        error: { code: "PAIRING_REQUIRED" },
      });
      expect(await readRecipeLibrary(page)).toEqual(after);
      const calls = bridge.callEvidence;
      expect(calls.length).toBe(8);
      expect(
        calls.every((c) => c.received && c.responseSha256?.length === 64),
      ).toBe(true);
      expect(new Set(calls.map((c) => c.id)).size).toBe(calls.length);
      await evidence(mode.name, {
        origin: mode.origin,
        pairing: mode.native
          ? "production launcher and real signed Windows verification"
          : "synthetic private-pipe verification",
        schemaVersions: schema.oneOf.map((v) => v.properties.schema.const),
        zeroWritesBeforeApproval: true,
        calls,
        ...(await readRecipeEvidence(page)),
      });
    } finally {
      await bridge.close();
      await context.close();
    }
  });
test("B1 same-batch create/reuse/defer uses exact approved IDs without scope expansion", async () => {
  test.setTimeout(120000);
  const { page, context } = await isolatedMcpBrowser(),
    bridge = await sdkBridge();
  try {
    const ids = await seedRecipeBrowser(page),
      before = await readRecipeLibrary(page),
      input = candidateRecipe(ids);
    await configure(page, { allAssets: false });
    await pairSynthetic(page, bridge);
    await beginWriteObservation(page);
    const denied = await bridge.call("krakinai_submit_change_set", {
      changeSet: browserRecipe(ids, { id: "synthetic-denied-unshared" }),
    });
    expect(denied).toMatchObject({
      ok: false,
      error: { code: "PERMISSION_DENIED" },
    });
    expect(await observedWrites(page)).toEqual([]);
    const submitted = await bridge.call("krakinai_submit_change_set", {
      changeSet: input,
    });
    expect(submitted.ok).toBe(true);
    await showMcpProposals(page);
    await page
      .getByRole("button", { name: "Review proposal", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Apply reviewed batch", exact: true }),
    ).toBeDisabled();
    expect(await readRecipeLibrary(page)).toEqual(before);
    await page
      .getByText("Reusable asset decisions (3)", { exact: true })
      .click();
    await page
      .getByRole("combobox", {
        name: "Decision for new-environment",
        exact: true,
      })
      .selectOption("reuse");
    await page
      .getByRole("combobox", {
        name: "Existing asset for new-environment",
        exact: true,
      })
      .selectOption("environment");
    for (const id of ["new-character", "new-action"]) {
      await page
        .getByRole("combobox", { name: "Decision for " + id, exact: true })
        .selectOption("create");
      const duplicate = page.getByLabel(
        `Create separate asset despite matches (${id})`,
        { exact: true },
      );
      if (await duplicate.count()) await duplicate.check();
    }
    expect(await observedWrites(page)).toEqual([]);
    await approveMcpContent(page);
    const after = await readRecipeLibrary(page),
      receipt = after.preferences.aiImports.receipts.find(
        (r) => r.changeSetId === input.changeSetId,
      ),
      scene = after.scenes.find((s) => s.id === receipt.idMappings.recipe.id),
      created = after.assets.filter(
        (a) => !before.assets.some((b) => b.id === a.id),
      );
    expect(created).toHaveLength(2);
    expect(scene.slots.environment.sourceId).toBe("environment");
    for (const slot of ["character", "action"]) {
      expect(scene.slots[slot].sourceId).toBe(
        receipt.idMappings["new-" + slot].assetId,
      );
      expect(
        created.find((a) => a.id === scene.slots[slot].sourceId).reviewStatus,
      ).toBe("unreviewed");
    }
    expect(scene.slots.character.identityAnchor).toBeUndefined();
    expect(
      after.assets.filter((a) => before.assets.some((b) => b.id === a.id)),
    ).toEqual(before.assets);
    expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
      ids.oldSceneId,
    );
    const search = await bridge.call("krakinai_search_assets", {
      query: "Synthetic proposed character",
    });
    expect(search.data.items).toEqual([]);
    const status = await bridge.call("krakinai_get_proposal_status", {
      proposalId: submitted.data.proposalId,
    });
    expect(status.data.receipt.idMappings.recipe.id).toBe(scene.id);
    await evidence("sdk-candidates", {
      zeroWritesBeforeApproval: true,
      deferredDependencyBlocked: true,
      createdAssetIds: created.map((a) => a.id),
      reusedEnvironmentId: scene.slots.environment.sourceId,
      calls: bridge.callEvidence,
      ...(await readRecipeEvidence(page)),
    });
  } finally {
    await bridge.close();
    await context.close();
  }
});
