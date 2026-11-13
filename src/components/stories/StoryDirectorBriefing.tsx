import React, { useState } from 'react';
import {
  Clapperboard,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  X,
  Check,
  Shield,
  Sun,
  Activity,
  Mic,
} from 'lucide-react';
import type {
  Story,
  PromptAsset,
  StoryDirectorBriefing as DirectorBriefingType,
  StoryContinuityLockEntry,
  StoryLightingProgressionEntry,
  StoryActionArchetypeEntry,
  StoryVocalPerformanceEntry,
  StoryBriefingAssetKind,
} from '../../types/domain';

interface StoryDirectorBriefingProps {
  story: Story;
  assets?: PromptAsset[];
  onUpdateStory: (updatedStory: Story) => Promise<void>;
}

export const StoryDirectorBriefing: React.FC<StoryDirectorBriefingProps> = ({
  story,
  assets = [],
  onUpdateStory,
}) => {
  const briefing: DirectorBriefingType = story.directorBriefing ?? {
    pacingAuditSummary: '',
    continuityLocks: [],
    lightingProgression: [],
    actionArchetypes: [],
    vocalRegister: [],
  };

  // Modal editing states
  const [editingPacing, setEditingPacing] = useState(false);
  const [pacingDraft, setPacingDraft] = useState(briefing.pacingAuditSummary ?? '');

  const [continuityModal, setContinuityModal] = useState<StoryContinuityLockEntry | null>(null);
  const [lightingModal, setLightingModal] = useState<StoryLightingProgressionEntry | null>(null);
  const [actionModal, setActionModal] = useState<StoryActionArchetypeEntry | null>(null);
  const [vocalModal, setVocalModal] = useState<StoryVocalPerformanceEntry | null>(null);

  const saveBriefing = async (updatedBriefing: DirectorBriefingType) => {
    const updatedStory: Story = {
      ...story,
      directorBriefing: updatedBriefing,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateStory(updatedStory);
  };

  // Continuity Locks Handlers
  const handleSaveContinuity = async () => {
    if (!continuityModal) return;
    const current = briefing.continuityLocks ?? [];
    const index = current.findIndex((c) => c.id === continuityModal.id);
    let next: StoryContinuityLockEntry[];
    if (index >= 0) {
      next = [...current];
      next[index] = continuityModal;
    } else {
      next = [...current, continuityModal];
    }
    await saveBriefing({ ...briefing, continuityLocks: next });
    setContinuityModal(null);
  };

  const handleDeleteContinuity = async (id: string) => {
    const next = (briefing.continuityLocks ?? []).filter((c) => c.id !== id);
    await saveBriefing({ ...briefing, continuityLocks: next });
  };

  // Lighting Progression Handlers
  const handleSaveLighting = async () => {
    if (!lightingModal) return;
    const current = briefing.lightingProgression ?? [];
    const index = current.findIndex((l) => l.id === lightingModal.id);
    let next: StoryLightingProgressionEntry[];
    if (index >= 0) {
      next = [...current];
      next[index] = lightingModal;
    } else {
      next = [...current, lightingModal];
    }
    await saveBriefing({ ...briefing, lightingProgression: next });
    setLightingModal(null);
  };

  const handleDeleteLighting = async (id: string) => {
    const next = (briefing.lightingProgression ?? []).filter((l) => l.id !== id);
    await saveBriefing({ ...briefing, lightingProgression: next });
  };

  // Action Archetypes Handlers
  const handleSaveAction = async () => {
    if (!actionModal) return;
    const current = briefing.actionArchetypes ?? [];
    const index = current.findIndex((a) => a.id === actionModal.id);
    let next: StoryActionArchetypeEntry[];
    if (index >= 0) {
      next = [...current];
      next[index] = actionModal;
    } else {
      next = [...current, actionModal];
    }
    await saveBriefing({ ...briefing, actionArchetypes: next });
    setActionModal(null);
  };

  const handleDeleteAction = async (id: string) => {
    const next = (briefing.actionArchetypes ?? []).filter((a) => a.id !== id);
    await saveBriefing({ ...briefing, actionArchetypes: next });
  };

  // Vocal Register Handlers
  const handleSaveVocal = async () => {
    if (!vocalModal) return;
    const current = briefing.vocalRegister ?? [];
    const index = current.findIndex((v) => v.id === vocalModal.id);
    let next: StoryVocalPerformanceEntry[];
    if (index >= 0) {
      next = [...current];
      next[index] = vocalModal;
    } else {
      next = [...current, vocalModal];
    }
    await saveBriefing({ ...briefing, vocalRegister: next });
    setVocalModal(null);
  };

  const handleDeleteVocal = async (id: string) => {
    const next = (briefing.vocalRegister ?? []).filter((v) => v.id !== id);
    await saveBriefing({ ...briefing, vocalRegister: next });
  };

  // Seed sample briefing
  const handleSeedSampleBriefing = async () => {
    const seeded: DirectorBriefingType = {
      pacingAuditSummary: '✅ All beats verified for 5–10s Google Flow Omni clip budget (<= 18 words dialogue / <= 14 words dialogue + action per beat).',
      continuityLocks: [
        {
          id: `cl-${Date.now()}-1`,
          assetType: 'character',
          candidateRefOrId: 'char-kael',
          description: 'Kael (20s, humanoid silver wolf in scarred leather brigandine, amber eyes, work-hardened claws).',
        },
        {
          id: `cl-${Date.now()}-2`,
          assetType: 'character',
          candidateRefOrId: 'char-elowen',
          description: 'Elowen (20s, cream-wooled humanoid sheep healer in woven linen apron, curved horn crown).',
        },
        {
          id: `cl-${Date.now()}-3`,
          assetType: 'environment',
          candidateRefOrId: 'env-healer-cellar',
          description: 'Darkened stone apothecary cellar, dried chamomile bundles, amber tinctures, stone mortar bowls.',
        },
      ],
      lightingProgression: [
        {
          id: `lp-${Date.now()}-1`,
          beatRange: 'BEAT-01–03',
          candidateRefOrId: 'light-timberline-dawn',
          setupAndMood: 'Cold 6500K pine ridge mist key with pale amber 3200K dawn rim; tense, desperate mood.',
        },
        {
          id: `lp-${Date.now()}-2`,
          beatRange: 'BEAT-04–06',
          candidateRefOrId: 'light-cellar-candle',
          setupAndMood: 'Warm 2400K flickering candlelight key, deep shadowed falloff; intimate, vulnerable sanctuary.',
        },
      ],
      actionArchetypes: [
        {
          id: `aa-${Date.now()}-1`,
          beatRange: 'BEAT-01',
          candidateRefOrId: 'act-predatory-crouch',
          kinematicsAndIntensity: 'Low perimeter crouch, claws digging into frozen black loam, controlled ragged breathing.',
        },
        {
          id: `aa-${Date.now()}-2`,
          beatRange: 'BEAT-05',
          candidateRefOrId: 'act-tender-binding',
          kinematicsAndIntensity: 'Pressing crushed willow bark against bleeding shoulder with steady gentle hands, kneeling beside timber cot.',
        },
      ],
      vocalRegister: [
        {
          id: `vr-${Date.now()}-1`,
          character: 'Kael',
          beatId: 'BEAT-05',
          emotion: 'Vulnerable / Ashamed',
          deliveryTechnique: 'Raspy whisper, breathy strained voice',
          voiceCharacteristics: 'Low gravelly baritone',
          speechIntonation: 'Falling cadence on "Kaaway mo ako"',
          bodyLanguage: 'Eyes cast down at claws, flinching from willow bark',
        },
        {
          id: `vr-${Date.now()}-2`,
          character: 'Elowen',
          beatId: 'BEAT-06',
          emotion: 'Compassionate / Resolute',
          deliveryTechnique: 'Soft projected, steady supportive voice',
          voiceCharacteristics: 'Warm melodic soprano',
          speechIntonation: 'Even emphatic stress on "Gutom ka lang"',
          bodyLanguage: 'Holding eye contact, unwavering posture beside lantern',
        },
      ],
    };
    await saveBriefing(seeded);
  };

  const hasAnyEntries =
    (briefing.continuityLocks?.length ?? 0) > 0 ||
    (briefing.lightingProgression?.length ?? 0) > 0 ||
    (briefing.actionArchetypes?.length ?? 0) > 0 ||
    (briefing.vocalRegister?.length ?? 0) > 0;

  return (
    <div className="story-director-briefing-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header & Pacing Audit Banner */}
      <div className="card" style={{ padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clapperboard size={22} style={{ color: '#2563EB' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                Director's Handoff Briefing
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Continuity locks, lighting progression, action archetypes, and Performance Studio registers
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!hasAnyEntries && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleSeedSampleBriefing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563EB', borderColor: '#BFDBFE', background: '#EFF6FF' }}
              >
                <Sparkles size={14} />
                <span>✨ Seed Sample Briefing</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPacingDraft(briefing.pacingAuditSummary ?? '');
                setEditingPacing(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Edit2 size={13} />
              <span>Edit Pacing Audit</span>
            </button>
          </div>
        </div>

        {/* Pacing Audit Note */}
        <div style={{ padding: '10px 14px', background: '#FFFFFF', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem', color: '#334155' }}>
          <strong>Pacing Audit: </strong>
          {briefing.pacingAuditSummary ? (
            <span>{briefing.pacingAuditSummary}</span>
          ) : (
            <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
              No beat duration audit logged. Verified for 5–10s Google Flow Omni clip window.
            </span>
          )}
        </div>
      </div>

      {/* Table 1: Character, Wardrobe & Environment Continuity */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} style={{ color: '#3B82F6' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Character, Wardrobe & Environment Continuity
            </h3>
            <span className="badge badge-subtle">{briefing.continuityLocks?.length ?? 0} Locked</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              setContinuityModal({
                id: `cl-${Date.now()}`,
                assetType: 'character',
                candidateRefOrId: '',
                description: '',
              })
            }
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} />
            <span>Add Continuity Lock</span>
          </button>
        </div>

        {(briefing.continuityLocks?.length ?? 0) === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            No continuity locks added yet. Add characters, wardrobe states, or key set environments.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px 12px', width: '15%' }}>Asset Type</th>
                  <th style={{ padding: '8px 12px', width: '25%' }}>Candidate Ref / ID</th>
                  <th style={{ padding: '8px 12px' }}>Description & Continuity Lock</th>
                  <th style={{ padding: '8px 12px', width: '90px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {briefing.continuityLocks.map((cl) => {
                  const isMatched = assets.some((a) => a.id === cl.candidateRefOrId);
                  return (
                    <tr key={cl.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>
                        <span className="badge" style={{ background: '#F1F5F9', color: '#334155' }}>
                          {cl.assetType}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{cl.candidateRefOrId}</span>
                          {isMatched && (
                            <span title="Matched in KRAKINAI Library" style={{ color: '#16A34A', display: 'inline-flex' }}>
                              <CheckCircle2 size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{cl.description}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setContinuityModal({ ...cl })}
                            aria-label="Edit Continuity Lock"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleDeleteContinuity(cl.id)}
                            aria-label="Delete Continuity Lock"
                            style={{ color: '#EF4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table 2: Lighting & Mood Progression */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sun size={18} style={{ color: '#F59E0B' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Lighting & Mood Progression
            </h3>
            <span className="badge badge-subtle">{briefing.lightingProgression?.length ?? 0} Setups</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              setLightingModal({
                id: `lp-${Date.now()}`,
                beatRange: '',
                candidateRefOrId: '',
                setupAndMood: '',
              })
            }
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} />
            <span>Add Lighting Setup</span>
          </button>
        </div>

        {(briefing.lightingProgression?.length ?? 0) === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            No lighting progression setups added.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px 12px', width: '18%' }}>Beat Range</th>
                  <th style={{ padding: '8px 12px', width: '22%' }}>Candidate Ref / ID</th>
                  <th style={{ padding: '8px 12px' }}>Key/Fill/Rim Setup & Atmospheric Mood</th>
                  <th style={{ padding: '8px 12px', width: '90px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {briefing.lightingProgression.map((lp) => (
                  <tr key={lp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lp.beatRange}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#2563EB' }}>
                      {lp.candidateRefOrId}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>{lp.setupAndMood}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setLightingModal({ ...lp })}
                          aria-label="Edit Lighting Setup"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDeleteLighting(lp.id)}
                          aria-label="Delete Lighting Setup"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table 3: Action & Emotion Archetypes */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} style={{ color: '#10B981' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Action & Emotion Archetypes
            </h3>
            <span className="badge badge-subtle">{briefing.actionArchetypes?.length ?? 0} Archetypes</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              setActionModal({
                id: `aa-${Date.now()}`,
                beatRange: '',
                candidateRefOrId: '',
                kinematicsAndIntensity: '',
              })
            }
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} />
            <span>Add Action Archetype</span>
          </button>
        </div>

        {(briefing.actionArchetypes?.length ?? 0) === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            No action archetypes registered.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px 12px', width: '18%' }}>Beat Range</th>
                  <th style={{ padding: '8px 12px', width: '22%' }}>Candidate Ref / ID</th>
                  <th style={{ padding: '8px 12px' }}>Physical Kinematics, Posture & Intensity</th>
                  <th style={{ padding: '8px 12px', width: '90px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {briefing.actionArchetypes.map((aa) => (
                  <tr key={aa.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{aa.beatRange}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#059669' }}>
                      {aa.candidateRefOrId}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>{aa.kinematicsAndIntensity}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setActionModal({ ...aa })}
                          aria-label="Edit Action Archetype"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDeleteAction(aa.id)}
                          aria-label="Delete Action Archetype"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table 4: Vocal & Performance Register */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mic size={18} style={{ color: '#8B5CF6' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Vocal & Performance Register
            </h3>
            <span className="badge badge-subtle">{briefing.vocalRegister?.length ?? 0} Cues</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              setVocalModal({
                id: `vr-${Date.now()}`,
                character: '',
                beatId: '',
                emotion: '',
                deliveryTechnique: '',
                voiceCharacteristics: '',
                speechIntonation: '',
                bodyLanguage: '',
              })
            }
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} />
            <span>Add Vocal Cue</span>
          </button>
        </div>

        {(briefing.vocalRegister?.length ?? 0) === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            No vocal or performance cues logged. These directly guide KRAKINAI Performance Studio V2.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px 12px', width: '12%' }}>Character</th>
                  <th style={{ padding: '8px 12px', width: '10%' }}>Beat</th>
                  <th style={{ padding: '8px 12px', width: '18%' }}>Emotion & Technique</th>
                  <th style={{ padding: '8px 12px', width: '25%' }}>Voice & Speech Intonation</th>
                  <th style={{ padding: '8px 12px' }}>Body Language / Gestures</th>
                  <th style={{ padding: '8px 12px', width: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {briefing.vocalRegister.map((vr) => (
                  <tr key={vr.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{vr.character}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748B' }}>
                      {vr.beatId}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#7C3AED' }}>{vr.emotion}</div>
                      {vr.deliveryTechnique && (
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{vr.deliveryTechnique}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      <div>{vr.voiceCharacteristics}</div>
                      {vr.speechIntonation && (
                        <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' }}>
                          "{vr.speechIntonation}"
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>{vr.bodyLanguage}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setVocalModal({ ...vr })}
                          aria-label="Edit Vocal Cue"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDeleteVocal(vr.id)}
                          aria-label="Delete Vocal Cue"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Pacing Modal */}
      {editingPacing && (
        <div className="modal-backdrop" onClick={() => setEditingPacing(false)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Pacing Audit Summary"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540, width: '92vw', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Pacing Audit Summary</h3>
              <button type="button" className="icon-btn" onClick={() => setEditingPacing(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 16 }}>
              <textarea
                className="input-field"
                rows={4}
                style={{ width: '100%' }}
                placeholder="Describe beat duration audit, Google Flow Omni 5-10s compliance..."
                value={pacingDraft}
                onChange={(e) => setPacingDraft(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #F1F5F9' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEditingPacing(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await saveBriefing({ ...briefing, pacingAuditSummary: pacingDraft });
                  setEditingPacing(false);
                }}
              >
                Save Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continuity Modal */}
      {continuityModal && (
        <div className="modal-backdrop" onClick={() => setContinuityModal(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Continuity Lock"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '92vw', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Continuity Lock Entry</h3>
              <button type="button" className="icon-btn" onClick={() => setContinuityModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Asset Type</label>
                <select
                  className="input-field"
                  style={{ width: '100%' }}
                  value={continuityModal.assetType}
                  onChange={(e) =>
                    setContinuityModal({ ...continuityModal, assetType: e.target.value as StoryBriefingAssetKind })
                  }
                >
                  <option value="character">Character</option>
                  <option value="wardrobe">Wardrobe</option>
                  <option value="environment">Environment</option>
                  <option value="style">Style</option>
                  <option value="camera">Camera</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Candidate Ref or Asset ID</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. char-kael or asset_123"
                  value={continuityModal.candidateRefOrId}
                  onChange={(e) => setContinuityModal({ ...continuityModal, candidateRefOrId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description & Continuity Lock</label>
                <textarea
                  className="input-field"
                  rows={3}
                  style={{ width: '100%' }}
                  placeholder="Physical traits, face, garments, spatial layout..."
                  value={continuityModal.description}
                  onChange={(e) => setContinuityModal({ ...continuityModal, description: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #F1F5F9' }}>
              <button type="button" className="btn btn-outline" onClick={() => setContinuityModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveContinuity}>
                Save Continuity Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lighting Modal */}
      {lightingModal && (
        <div className="modal-backdrop" onClick={() => setLightingModal(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Lighting Setup"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '92vw', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Lighting & Mood Setup</h3>
              <button type="button" className="icon-btn" onClick={() => setLightingModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Beat Range</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. BEAT-01–03"
                  value={lightingModal.beatRange}
                  onChange={(e) => setLightingModal({ ...lightingModal, beatRange: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Candidate Ref or Lighting Asset ID</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. light-timberline-dawn"
                  value={lightingModal.candidateRefOrId}
                  onChange={(e) => setLightingModal({ ...lightingModal, candidateRefOrId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Key/Fill/Rim Setup & Atmospheric Mood</label>
                <textarea
                  className="input-field"
                  rows={3}
                  style={{ width: '100%' }}
                  placeholder="Key light, color temp (Kelvin), rim light, volumetric fog, mood..."
                  value={lightingModal.setupAndMood}
                  onChange={(e) => setLightingModal({ ...lightingModal, setupAndMood: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #F1F5F9' }}>
              <button type="button" className="btn btn-outline" onClick={() => setLightingModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveLighting}>
                Save Lighting Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Archetype Modal */}
      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Action Archetype"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '92vw', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Action Archetype Entry</h3>
              <button type="button" className="icon-btn" onClick={() => setActionModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Beat Range</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. BEAT-01"
                  value={actionModal.beatRange}
                  onChange={(e) => setActionModal({ ...actionModal, beatRange: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Candidate Ref or Action Asset ID</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. act-predatory-crouch"
                  value={actionModal.candidateRefOrId}
                  onChange={(e) => setActionModal({ ...actionModal, candidateRefOrId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Physical Kinematics, Posture & Intensity</label>
                <textarea
                  className="input-field"
                  rows={3}
                  style={{ width: '100%' }}
                  placeholder="Kinematics, gesture, body weight transfer, speed, emotional intensity..."
                  value={actionModal.kinematicsAndIntensity}
                  onChange={(e) => setActionModal({ ...actionModal, kinematicsAndIntensity: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #F1F5F9' }}>
              <button type="button" className="btn btn-outline" onClick={() => setActionModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveAction}>
                Save Action Archetype
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vocal Performance Modal */}
      {vocalModal && (
        <div className="modal-backdrop" onClick={() => setVocalModal(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Vocal Cue"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540, width: '92vw', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Vocal & Performance Register</h3>
              <button type="button" className="icon-btn" onClick={() => setVocalModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Character</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. Kael"
                    value={vocalModal.character}
                    onChange={(e) => setVocalModal({ ...vocalModal, character: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Beat ID</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. BEAT-05"
                    value={vocalModal.beatId}
                    onChange={(e) => setVocalModal({ ...vocalModal, beatId: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Emotion</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. Vulnerable / Ashamed"
                    value={vocalModal.emotion}
                    onChange={(e) => setVocalModal({ ...vocalModal, emotion: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Delivery Technique</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. Raspy whisper"
                    value={vocalModal.deliveryTechnique}
                    onChange={(e) => setVocalModal({ ...vocalModal, deliveryTechnique: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Voice Characteristics</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. Low gravelly baritone, gravel texture"
                  value={vocalModal.voiceCharacteristics}
                  onChange={(e) => setVocalModal({ ...vocalModal, voiceCharacteristics: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Speech & Intonation</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. Falling cadence on final syllable"
                  value={vocalModal.speechIntonation}
                  onChange={(e) => setVocalModal({ ...vocalModal, speechIntonation: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Body Language / Gestures</label>
                <textarea
                  className="input-field"
                  rows={2}
                  style={{ width: '100%' }}
                  placeholder="e.g. Eyes cast down at claws, flinching from treatment"
                  value={vocalModal.bodyLanguage}
                  onChange={(e) => setVocalModal({ ...vocalModal, bodyLanguage: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #F1F5F9' }}>
              <button type="button" className="btn btn-outline" onClick={() => setVocalModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveVocal}>
                Save Vocal Cue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
