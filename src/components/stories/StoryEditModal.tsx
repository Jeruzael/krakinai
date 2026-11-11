import React, { useState, useEffect } from 'react';
import type { Story } from '../../types/domain';
import { useLibrary } from '../../context/LibraryContext';
import { BookOpen, Check, Edit3, Film, Sparkles, Tag, User, X } from 'lucide-react';

export interface StoryEditModalProps {
  story: Story | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStory: Story) => Promise<void> | void;
}

export const StoryEditModal: React.FC<StoryEditModalProps> = ({
  story,
  isOpen,
  onClose,
  onSave,
}) => {
  const { snapshot, showToast } = useLibrary();

  const [activeTab, setActiveTab] = useState<'info' | 'treatment'>('info');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [logline, setLogline] = useState('');
  const [premise, setPremise] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [linkedCollectionId, setLinkedCollectionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(story?.title ?? '');
      setAuthor(story?.author ?? '');
      setLogline(story?.logline ?? '');
      setPremise(story?.premise ?? '');
      setSynopsis(story?.synopsis ?? '');
      setTreatment(story?.treatment ?? '');
      setTagsStr((story?.tags ?? []).join(', '));
      setLinkedCollectionId(story?.linkedCollectionId ?? '');
      setError(null);
      setActiveTab('info');
    }
  }, [isOpen, story]);

  if (!isOpen) return null;

  const isCreateMode = !story || story.title === 'Untitled Story' && story.revisionNumber === 1;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Story title is required');
      setActiveTab('info');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const parsedTags = tagsStr
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean);

      const baseStory: Story = story ?? {
        id: `story_${Date.now()}`,
        title: '',
        author: 'Author',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        favorite: false,
        revisionNumber: 1,
        tags: [],
        logline: '',
        premise: '',
        synopsis: '',
        treatment: '',
        fullBookText: '',
        referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
        colorScript: [],
        acts: [],
      };

      const updated: Story = {
        ...baseStory,
        title: title.trim(),
        author: author.trim() || 'Author',
        logline: logline.trim(),
        premise: premise.trim(),
        synopsis: synopsis.trim(),
        treatment: treatment.trim(),
        tags: parsedTags,
        linkedCollectionId: linkedCollectionId || null,
        updatedAt: new Date().toISOString(),
        revisionNumber: isCreateMode ? 1 : (baseStory.revisionNumber || 1) + 1,
      };

      await onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save story details');
    } finally {
      setSaving(false);
    }
  };

  const collections = snapshot?.collections ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel modal-card story-edit-modal"
        role="dialog"
        aria-label={isCreateMode ? 'Create New Story' : 'Edit Story Details'}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '94vw',
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCreateMode ? <BookOpen size={20} /> : <Edit3 size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A', fontWeight: 700 }}>
                {isCreateMode ? 'Create New Story' : 'Edit Story Details'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                {isCreateMode
                  ? 'Set up narrative title, author, logline, and literary treatment'
                  : `Update metadata and pitch notes for "${story?.title || 'Story'}"`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 6, color: '#64748B' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Section Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: '0 20px',
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'info' ? 600 : 500,
              color: activeTab === 'info' ? '#2563EB' : '#64748B',
              borderBottom: activeTab === 'info' ? '2px solid #2563EB' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BookOpen size={15} />
            <span>Story Core & Logline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('treatment')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'treatment' ? 600 : 500,
              color: activeTab === 'treatment' ? '#2563EB' : '#64748B',
              borderBottom: activeTab === 'treatment' ? '2px solid #2563EB' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={15} />
            <span>Premise, Synopsis & Pitch</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
          <div
            className="modal-body"
            style={{
              padding: '20px',
              maxHeight: '65vh',
              overflowY: 'auto',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            {activeTab === 'info' && (
              <>
                {/* Title */}
                <div>
                  <label
                    htmlFor="story-edit-title"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Story Title <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    id="story-edit-title"
                    type="text"
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.95rem' }}
                    placeholder="e.g. Wool and Fang: The Timberline Snare"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Author */}
                <div>
                  <label
                    htmlFor="story-edit-author"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Author / Co-Author Attribution
                  </label>
                  <input
                    id="story-edit-author"
                    type="text"
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.9rem' }}
                    placeholder="e.g. KRAKINAI Studio & Antigravity"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>

                {/* Logline */}
                <div>
                  <label
                    htmlFor="story-edit-logline"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Logline (One-Sentence Hook)
                  </label>
                  <textarea
                    id="story-edit-logline"
                    className="input-field"
                    rows={2}
                    style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.4 }}
                    placeholder="A concise, compelling sentence capturing protagonist, conflict, and stakes..."
                    value={logline}
                    onChange={(e) => setLogline(e.target.value)}
                  />
                </div>

                {/* Tags & Paired Project */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label
                      htmlFor="story-edit-tags"
                      style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                    >
                      Tags (comma-separated)
                    </label>
                    <input
                      id="story-edit-tags"
                      type="text"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      placeholder="fantasy, drama, beastfolk"
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="story-edit-collection"
                      style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                    >
                      Paired Storyboard Project
                    </label>
                    <select
                      id="story-edit-collection"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={linkedCollectionId}
                      onChange={(e) => setLinkedCollectionId(e.target.value)}
                    >
                      <option value="">None (Independent Story)</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'treatment' && (
              <>
                {/* Premise */}
                <div>
                  <label
                    htmlFor="story-edit-premise"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Dramatic Premise
                  </label>
                  <textarea
                    id="story-edit-premise"
                    className="input-field"
                    rows={2}
                    style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.4 }}
                    placeholder="Core thematic question or moral dilemma driving the narrative..."
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                  />
                </div>

                {/* Synopsis */}
                <div>
                  <label
                    htmlFor="story-edit-synopsis"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Extended Synopsis
                  </label>
                  <textarea
                    id="story-edit-synopsis"
                    className="input-field"
                    rows={3}
                    style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.4 }}
                    placeholder="Narrative summary describing the beginning, escalation, and resolution..."
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                  />
                </div>

                {/* Story Pitch & Treatment */}
                <div>
                  <label
                    htmlFor="story-edit-treatment"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}
                  >
                    Story Pitch & 3-Act Treatment
                  </label>
                  <textarea
                    id="story-edit-treatment"
                    className="input-field"
                    rows={5}
                    style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.5, fontFamily: 'monospace' }}
                    placeholder={`ACT I: THE SETUP\nDescribe the initial world and inciting incident...\n\nACT II: THE CONFRONTATION\nDescribe escalating stakes and midpoint reversal...\n\nACT III: THE RESOLUTION\nDescribe the climax and resolution...`}
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer"
            style={{
              padding: '14px 20px',
              background: '#F8FAFC',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Check size={16} />
              <span>{isCreateMode ? 'Create Story' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
