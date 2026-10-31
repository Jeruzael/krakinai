import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  beginWriteObservation,
  observedWrites,
  openRecipeOperation,
} from "./recipe-change-set-fixture.mjs";
import {
  seedEnsembleBrowser,
  ensembleBrowserRecipe,
  readEnsembleLibrary,
  ensembleEvidence,
  chooseOutfitCreate,
  exactEnsembleLine,
} from "./ensemble-fixture.mjs";
async function configure(page, ids) {
  await page.goto("/#/connections/ai");
  await setMcpFlag(page, "Allow change-set proposals", true);
  await selectMcpRecord(page, "Projects", ids.projectName);
  for (const label of [
    "Aya / Base Identity · characters",
    "Lucas / Base Identity · characters",
    "Synthetic Courtyard · environments",
    "Synthetic Greeting · actions",
    "Synthetic Static Camera · camera",
  ])
    await selectMcpRecord(page, "Reusable assets", label);
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
  { name: "sdk-synthetic", origin: "http://127.0.0.1:4173", native: false },
  { name: "signed-native-ipv4", origin: "http://127.0.0.1:4173", native: true },
  {
    name: "signed-native-localhost",
    origin: "http://localhost:4173",
    native: true,
  },
])
  test(`B2 ${mode.name}: actual stdio SDK revision, Outfit, browser approval, receipt and revocation`, async () => {
    test.skip(
      mode.native &&
        (process.platform !== "win32" ||
          process.env.KRAKINAI_NATIVE_QA !== "1"),
      "Requires opt-in Valid signed Windows helper and retained synthetic profile.",
    );
    test.setTimeout(150000);
    const { page, context } = await isolatedMcpBrowser(
        { width: 1440, height: 900 },
        1,
        mode.origin,
      ),
      bridge = await sdkBridge({
        production: mode.native,
        origin: mode.origin,
      }),
      calls = [];
    const ask = async (tool, args = {}, ok = true) => {
      const response = await bridge.call(tool, args),
        evidence = bridge.callEvidence.at(-1);
      expect(evidence).toMatchObject({ tool, received: true, ok });
      expect(response.ok).toBe(ok);
      expect(evidence.responseSha256).toMatch(/^[a-f0-9]{64}$/);
      calls.push({ ...evidence, expectedOk: ok });
      return response;
    };
    try {
      const ids = await seedEnsembleBrowser(page),
        input = ensembleBrowserRecipe(ids, {
          id: `synthetic-b2-${mode.name}`,
          outfit: true,
        });
      expect(await page.evaluate(() => location.origin)).toBe(mode.origin);
      const other = await context.newPage();
      await other.goto(
        (mode.origin.includes("localhost")
          ? "http://127.0.0.1:4173"
          : "http://localhost:4173") + "/#/",
      );
      expect(
        await other.evaluate(async () => {
          const s = await (await import("/src/storage/db.ts")).getAllSnapshot();
          return [s.assets.length, s.scenes.length, s.collections.length];
        }),
      ).toEqual([0, 0, 0]);
      await other.close();
      await configure(page, ids);
      if (mode.native) await pairNative(page, bridge, mode.origin);
      else await pairSynthetic(page, bridge);
      const before = await readEnsembleLibrary(page),
        hashes = (await ensembleEvidence(page)).mediaHashes;
      await beginWriteObservation(page);
      const tools = await bridge.client.listTools();
      expect(
        tools.tools
          .find((t) => t.name === "krakinai_submit_change_set")
          .inputSchema.properties.changeSet.oneOf.map(
            (s) => s.properties.schema.const,
          ),
      ).toEqual([
        "krakinai.change-set.v1",
        "krakinai.change-set.v2",
        "krakinai.change-set.v3",
      ]);
      const metadata = await ask("krakinai_get_scene", {
        sceneId: ids.parentId,
      });
      expect(JSON.stringify(metadata)).not.toMatch(
        /SYNTHETIC_PRIVATE_|synthetic-aya\.png|synthetic-lucas\.png/,
      );
      expect(JSON.stringify(metadata)).not.toContain(exactEnsembleLine);
      const preview = await ask("krakinai_preview_change_set", {
          changeSet: input,
        }),
        submitted = await ask("krakinai_submit_change_set", {
          changeSet: input,
        });
      expect(submitted.data.status).toBe("review_required");
      expect(JSON.stringify([preview, submitted])).not.toContain(
        "SYNTHETIC_PRIVATE_",
      );
      expect(await observedWrites(page)).toEqual([]);
      expect(await readEnsembleLibrary(page)).toEqual(before);
      await showMcpProposals(page);
      await page
        .getByRole("button", { name: "Review proposal", exact: true })
        .click();
      await chooseOutfitCreate(page);
      await openRecipeOperation(page, "ensemble");
      const displayedFull = await page
        .getByRole("textbox", {
          name: "Recipe Full output ensemble",
          exact: true,
        })
        .inputValue();
      expect(displayedFull).toContain("SYNTHETIC_PRIVATE_LUCAS_MASTER");
      await page
        .getByRole("button", { name: "Close operation", exact: true })
        .click();
      expect(await observedWrites(page)).toEqual([]);
      await approveMcpContent(page);
      const after = await readEnsembleLibrary(page),
        receipt = after.preferences.aiImports.receipts.find(
          (r) => r.changeSetId === input.changeSetId,
        ),
        scene = after.scenes.find(
          (s) => s.id === receipt.idMappings["new-scene"].id,
        ),
        variantId = receipt.idMappings["new-outfit"].variantId;
      expect(scene.sceneRevision).toMatchObject({
        rootSceneId: ids.parentId,
        parentSceneId: ids.parentId,
        sequence: 2,
      });
      expect(scene.outputs.full.replaceAll("\r\n", "\n")).toBe(displayedFull);
      expect(scene.ensemble.dialogueCues[1].line).toBe(exactEnsembleLine);
      expect(scene.ensemble.participants[1].wardrobe.sourceId).toBe(variantId);
      expect(after.variants.find((v) => v.id === variantId)).toMatchObject({
        type: "Outfit",
        parentCharacterId: "lucas",
        reviewStatus: "unreviewed",
      });
      for (const old of before.scenes)
        expect(after.scenes.find((s) => s.id === old.id)).toEqual(old);
      expect(after.assets).toEqual(before.assets);
      expect(after.drafts).toEqual(before.drafts);
      expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
        ids.oldSceneId,
      );
      expect((await ensembleEvidence(page)).mediaHashes).toEqual(hashes);
      const status = await ask("krakinai_get_proposal_status", {
          proposalId: submitted.data.proposalId,
        }),
        confirmed = await ask("krakinai_get_import_receipt", {
          changeSetId: receipt.changeSetId,
          packageDigest: receipt.packageDigest,
        });
      expect(status.data.receipt.idMappings["new-scene"].id).toBe(scene.id);
      expect(confirmed.data.idMappings["new-outfit"].variantId).toBe(variantId);
      expect(JSON.stringify([status, confirmed])).not.toContain(
        "SYNTHETIC_PRIVATE_",
      );
      const retry = await ask("krakinai_submit_change_set", {
        changeSet: input,
      });
      expect(retry.data.proposalId).toBe(submitted.data.proposalId);
      expect(await readEnsembleLibrary(page)).toEqual(after);
      const denied = await ask(
        "krakinai_get_generation_prompt",
        { sceneId: scene.id },
        false,
      );
      expect(denied.error.code).toBe("PERMISSION_DENIED");
      await page.getByRole("tab", { name: "Connection", exact: true }).click();
      await page
        .getByRole("button", { name: "Disconnect Codex", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Disconnect Codex?", exact: true })
        .getByRole("button", { name: "Disconnect now", exact: true })
        .click();
      expect((await ask("krakinai_connection_status")).data.connected).toBe(
        false,
      );
      expect((await ask("krakinai_list_projects", {}, false)).error.code).toBe(
        "PAIRING_REQUIRED",
      );
      expect(await readEnsembleLibrary(page)).toEqual(after);
      expect(new Set(calls.map((c) => c.id)).size).toBe(calls.length);
      expect(bridge.callEvidence).toHaveLength(calls.length);
      await mkdir("qa-results/ensemble-b2", { recursive: true });
      await writeFile(
        resolve("qa-results/ensemble-b2", `mcp-${mode.name}.json`),
        JSON.stringify(
          {
            origin: mode.origin,
            pairing: mode.native
              ? "Production stdio launcher and real Valid signed Windows verification"
              : "SDK stdio with synthetic private-pipe verification",
            calls,
            zeroWritesBeforeApproval: true,
            oldScenesAndPreferredPreserved: true,
            receipt,
            ...(await ensembleEvidence(page)),
          },
          null,
          2,
        ),
      );
    } finally {
      await bridge.close();
      await context.close();
    }
  });
