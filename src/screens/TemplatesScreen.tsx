import React, { useState } from 'react';
import { Eye, LayoutTemplate, PlayCircle, X } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { SLOT_LABELS } from '../domain/validation';
import type { Template, TemplateCategory } from '../types/domain';
import { createDraftFromTemplate } from '../storage/db';
import { ORDERED_BUILDER_SLOTS } from '../domain/promptAssembler';

const CATEGORIES: Array<'All' | TemplateCategory> = [
  'All',
  'Character',
  'Product',
  'B-roll',
  'Custom',
];

export const TemplatesScreen: React.FC = () => {
  const {
    snapshot,
    navigate,
    refreshSnapshot,
    openConfirmDialog,
    closeConfirmDialog,
    showToast,
  } = useLibrary();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'All' | TemplateCategory>('All');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  if (!snapshot) return null;

  const filtered = snapshot.templates.filter((t) => {
    if (catFilter !== 'All' && t.category !== catFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleUseTemplate = async (tpl: Template) => {
    const activeId = snapshot.preferences.activeDraftId;
    const activeDraft = activeId
      ? snapshot.drafts.find((d) => d.id === activeId)
      : undefined;
    const hasExistingDraftWork =
      activeDraft && Object.keys(activeDraft.slots).length > 0;

    const proceedToCreateDraft = async () => {
      const created = await createDraftFromTemplate(tpl.id);
      await refreshSnapshot();
      setPreviewTemplate(null);
      closeConfirmDialog();
      showToast(
        `Created new draft from template "${tpl.name}".`,
        'success'
      );
      navigate(`/builder/${created.id}`);
    };

    if (hasExistingDraftWork) {
      openConfirmDialog({
        title: 'Start New Draft From Template?',
        message: `You have an existing draft ("${activeDraft.title}"). Using "${tpl.name}" will keep your existing draft saved in the background and open a fresh draft with this template's defaults. Continue?`,
        confirmLabel: 'Keep Existing & Create New Draft',
        cancelLabel: 'Cancel',
        onConfirm: proceedToCreateDraft,
      });
      return;
    }

    await proceedToCreateDraft();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 className="page-title">Templates</h1>
        <p className="muted-text" style={{ margin: '4px 0 0' }}>
          Starting arrangements with copied default prompt blocks and required
          slot rules — not pre-generated videos. Defaults work even without
          loading the starter library.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`btn btn-sm ${
                  catFilter === c ? 'btn-primary' : 'btn-secondary'
                }`}
                onClick={() => setCatFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 240 }}>
            <input
              className="input"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="card-grid">
        {filtered.map((tpl) => (
          <article key={tpl.id} className="prompt-card">
            <div
              className="prompt-card-media"
              onClick={() => setPreviewTemplate(tpl)}
            >
              {tpl.illustrationSvg ? (
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(
                    tpl.illustrationSvg
                  )}`}
                  alt={`${tpl.name} illustrative preview`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--primary)',
                  }}
                >
                  <LayoutTemplate size={32} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    Custom Template
                  </span>
                </div>
              )}
            </div>

            <div className="prompt-card-body">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{tpl.category}</span>
                {tpl.isStarter && <span className="badge">Starter</span>}
              </div>

              <h3
                className="prompt-card-title"
                onClick={() => setPreviewTemplate(tpl)}
              >
                {tpl.name}
              </h3>

              <p className="prompt-card-excerpt">{tpl.description}</p>

              <div className="tag-list">
                {tpl.requiredSlots.map((slot) => (
                  <span key={slot} className="badge badge-warning">
                    Requires: {SLOT_LABELS[slot]}
                  </span>
                ))}
              </div>

              <div className="prompt-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPreviewTemplate(tpl)}
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleUseTemplate(tpl)}
                >
                  <PlayCircle size={14} /> Use Template
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Template Preview Drawer / Modal */}
      {previewTemplate && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-preview-title"
        >
          <div className="modal-panel" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h2 id="tpl-preview-title" className="section-title">
                  {previewTemplate.name}
                </h2>
                <span className="muted-text">
                  Template Preview • Starting Arrangement (Not a generated
                  video)
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPreviewTemplate(null)}
                aria-label="Close template preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ marginTop: 0 }}>{previewTemplate.description}</p>

              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 13 }}>
                  Required Slots for Assembly:
                </strong>
                <div className="tag-list" style={{ marginTop: 6 }}>
                  {previewTemplate.requiredSlots.map((s) => (
                    <span key={s} className="badge badge-warning">
                      {SLOT_LABELS[s]}
                    </span>
                  ))}
                </div>
              </div>

              <h3 style={{ fontSize: 15, marginBottom: 10 }}>
                Copied Default Slot Blocks:
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {ORDERED_BUILDER_SLOTS.map((slot) => {
                  const def = previewTemplate.defaults[slot];
                  if (!def) return null;
                  return (
                    <div
                      key={slot}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {SLOT_LABELS[slot]} — {def.title}
                      </div>
                      <p
                        className="muted-text"
                        style={{ margin: '4px 0 0', fontSize: 13 }}
                      >
                        {def.promptText}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewTemplate(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleUseTemplate(previewTemplate)}
              >
                <PlayCircle size={16} /> Use Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
