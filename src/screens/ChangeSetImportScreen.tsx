import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetPreview as Preview,
  ChangeSetReceipt,
  ImportCandidate,
  ImportVariantCandidate,
} from "../types/changeSet";
import { emptyChangeSetApproval } from "../types/changeSet";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { generateId } from "../storage/db";
import { MAX_CHANGE_SET_BYTES } from "../domain/changeSetValidation";
import { ChangeSetPreview } from "../components/ChangeSetPreview";
import { ImportReceipt } from "../components/ImportReceipt";
import "./changeSets.css";
export function ChangeSetImportScreen({initialChangeSet,onBack,onDirtyChange}:{initialChangeSet?:ChangeSet;onBack?:()=>void;onDirtyChange?:(dirty:boolean)=>void}={}) {
  const { snapshot, navigate, refreshSnapshot, setDirtyFormGuard } =
    useLibrary();
  const [raw, setRaw] = useState(()=>initialChangeSet?JSON.stringify(initialChangeSet,null,2):""),
    [preview, setPreview] = useState<Preview>(),
    [receipt, setReceipt] = useState<ChangeSetReceipt>(),
    [replay, setReplay] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<"preview" | "apply">();
  const generation = useRef(0),
    previewHeading = useRef<HTMLHeadingElement>(null),
    receiptHeading = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<"preview" | "receipt">();
  useLayoutEffect(() => {
    const target =
      focusTarget.current === "preview"
        ? previewHeading.current
        : focusTarget.current === "receipt"
          ? receiptHeading.current
          : undefined;
    if (target) {
      target.focus();
      focusTarget.current = undefined;
    }
  }, [preview, receipt]);
  useEffect(() => {
    const report=onDirtyChange??setDirtyFormGuard;
    report(!!raw.trim() && !receipt);
    return () => report(false);
  }, [raw, receipt, setDirtyFormGuard,onDirtyChange]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const resetPreview = () => {
    generation.current++;
    focusTarget.current = undefined;
    setPreview(undefined);
    setReceipt(undefined);
    setReviewed(false);
    setBusy(undefined);
    setError("");
  };
  const runPreview = async (text: string, approval?: ChangeSetApproval) => {
    const current = ++generation.current;
    setBusy("preview");
    setError("");
    setReviewed(false);
    try {
      const result = await previewChangeSet(text, approval);
      if (current !== generation.current) return;
      if (result.replay) {
        focusTarget.current = "receipt";
        setReceipt(result.replay);
        setReplay(true);
        setPreview(undefined);
      } else {
        if (approval === undefined) focusTarget.current = "preview";
        setPreview(result);
        setReceipt(undefined);
        setReplay(false);
      }
    } catch (cause) {
      if (current === generation.current) {
        if (approval)
          setPreview((previous) =>
            previous
              ? {
                  ...previous,
                  approval,
                  plan: {
                    ...previous.plan,
                    findings: [
                      ...previous.plan.findings.filter(
                        (f) => f.code !== "APPROVAL_INVALID",
                      ),
                      {
                        severity: "blocking",
                        code: "APPROVAL_INVALID",
                        message: (cause as Error).message,
                      },
                    ],
                  },
                }
              : undefined,
          );
        else setPreview(undefined);
        setError((cause as Error).message);
      }
    } finally {
      if (current === generation.current) setBusy(undefined);
    }
  };
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    resetPreview();
    if (file.size > MAX_CHANGE_SET_BYTES) {
      setError(
        "Change-set JSON exceeds the 20 MiB limit. The file was not read.",
      );
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Choose a .json change-set file.");
      return;
    }
    const current = ++generation.current;
    try {
      const value = await file.text();
      if (current === generation.current) setRaw(value);
    } catch {
      if (current === generation.current)
        setError(
          "Could not read this JSON file. Choose it again or paste the text.",
        );
    }
  };
  useEffect(()=>{if(initialChangeSet)void runPreview(JSON.stringify(initialChangeSet,null,2))},[]);
  const changeApproval = (approval: ChangeSetApproval) => {
    // Keep the chosen control value visible while its new read-only preview resolves.
    setPreview((previous) => (previous ? { ...previous, approval } : previous));
    void runPreview(raw, approval);
  };
  const apply = async () => {
    if (!preview || !reviewed || busy) return;
    setBusy("apply");
    setError("");
    try {
      const result = await applyApprovedChangeSet(
        preview,
        preview.approvedDigest,
      );
      focusTarget.current = "receipt";
      setReceipt(result);
      setReplay(false);
      setPreview(undefined);
      setReviewed(false);
      try {
        await refreshSnapshot();
      } catch (cause) {
        setError(
          `Changes were committed, but the view could not refresh: ${(cause as Error).message}. Reload to see the saved records. Re-importing this package returns its receipt without duplication.`,
        );
      }
    } catch (cause) {
      setError(
        `${(cause as Error).message} Nothing was applied. Review fresh context and preview again.`,
      );
      setReviewed(false);
    } finally {
      setBusy(undefined);
    }
  };
  const reviewCandidate = (candidate: ImportCandidate|ImportVariantCandidate) => {
    const outfit='variantType'in candidate;
    const input: ChangeSet = {
      schema: outfit?'krakinai.change-set.v3':"krakinai.change-set.v1",
      changeSetId: generateId("candidate_review"),
      source: { kind: "manual", label: "Pending candidate review" },
      title: `Review ${candidate.title}`.slice(0, 100),
      operations: [
        {
          operationId: "review-candidate",
          type: outfit?'variant.review_candidate':"asset.review_candidate",
          candidateId: candidate.id,
          expectedRevision: candidate.revision,
        },
      ],
    };
    const text = JSON.stringify(input, null, 2);
    resetPreview();
    setRaw(text);
    void runPreview(text);
  };
  if (!snapshot) return null;
  const blocked =
    preview?.plan.findings.some((f) => f.severity === "blocking") ?? true;
  const pending = [
    ...(snapshot.preferences.aiImports?.candidates.filter(
      (c) => c.status === "pending",
    ) ?? []),...(snapshot.preferences.aiImports?.variantCandidates?.filter(c=>c.status==='pending')??[])];
  return (
    <div className={`change-set-workspace${preview ? " has-preview" : ""}`}>
      <header className="import-heading">
        <div>
          <span className="import-eyebrow">Local production planning</span>
          <h1>Import AI Change Set</h1>
          <p className="muted-text">
            Preview a project, storyboard or revision package before approving
            any changes.
          </p>
        </div>
        <div className="import-buttons">
          {onBack&&<button type="button" className="btn btn-secondary" disabled={busy==='apply'} onClick={onBack}>Back to Recipe mapping</button>}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy === "apply"}
            onClick={() => navigate("/context/ai")}
          >
            Export Context for AI
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy === "apply"}
            onClick={() => navigate("/collections")}
          >
            Back to Collections
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="banner banner-warning">
          {error}
        </p>
      )}
      {!receipt && !preview && (
        <section className="card import-input">
          <label>
            Choose change-set JSON file
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy !== undefined}
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </label>
          <label>
            Change-set JSON
            <textarea
              value={raw}
              rows={10}
              maxLength={MAX_CHANGE_SET_BYTES}
              placeholder="Paste a krakinai.change-set.v1–v4 planning, Direct Prompt, recipe or conversion package"
              disabled={busy === "apply"}
              onChange={(e) => {
                resetPreview();
                setRaw(e.target.value);
              }}
            />
          </label>
          <p className="muted-text">
            JSON only · 20 MiB maximum · no media upload or AI connection. The
            old custom planning manifest is a different format.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!raw.trim() || busy !== undefined}
            onClick={() => void runPreview(raw)}
          >
            Preview changes
          </button>
        </section>
      )}
      {preview && (
        <>
          <ChangeSetPreview
            headingRef={previewHeading}
            preview={preview}
            snapshot={snapshot}
            disabled={busy === "apply"}
            onApproval={changeApproval}
          />
          <footer className="card import-action-area">
            <label className="import-check">
              <input
                type="checkbox"
                disabled={busy !== undefined || blocked}
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I reviewed this exact preview
            </label>
            <div className="import-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy === "apply"}
                onClick={() => resetPreview()}
              >
                Cancel preview
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy === "apply"}
                onClick={() => resetPreview()}
              >
                Edit JSON
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== undefined || blocked || !reviewed}
                onClick={() => void apply()}
              >
                Apply approved changes
              </button>
            </div>
          </footer>
        </>
      )}
      {busy && (
        <p role="status">
          {busy === "preview"
            ? "Validating current targets and exact proposed changes…"
            : "Saving approved batch…"}
        </p>
      )}
      {receipt && (
        <div
          ref={receiptHeading}
          role="region"
          aria-label="Import receipt"
          tabIndex={-1}
        >
          <ImportReceipt
            receipt={receipt}
            replay={replay}
            onNew={() => {
              resetPreview();
              setRaw("");
            }}
          />
        </div>
      )}
      {pending.length > 0 && !preview && (
        <details className="card import-group">
          <summary>Pending library candidates ({pending.length})</summary>
          <div className="import-pending-list">
            {pending.map((c) => (
              <div className="import-operation" key={c.id}>
                <div>
                  <strong>{c.title}</strong>
                  <small>
                    {'variantType'in c?`Outfit · parent ${c.parentCharacterId}`:c.kind} · pending · rev {c.revision}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy === "apply"}
                  onClick={() => reviewCandidate(c)}
                >
                  Review candidate {c.title}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
