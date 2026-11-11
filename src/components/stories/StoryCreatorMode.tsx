import React, { useState } from 'react';
import type { StoryAct, StorySequence, StorySceneNode, StoryBeat, StoryDramaticMeta } from '../../types/domain';
import { ChevronDown, ChevronRight, Plus, Trash2, Edit3, Film, Clapperboard, Sparkles } from 'lucide-react';

export interface StoryCreatorModeProps {
  acts: StoryAct[];
  onUpdateActs?: (acts: StoryAct[]) => void;
  readOnly?: boolean;
}

export const StoryCreatorMode: React.FC<StoryCreatorModeProps> = ({
  acts,
  onUpdateActs,
  readOnly = false,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    acts.forEach((act) => {
      init[act.id] = true;
      act.sequences.forEach((seq) => {
        init[seq.id] = true;
        seq.scenes.forEach((sc) => {
          init[sc.id] = true;
        });
      });
    });
    return init;
  });

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderDramaticMeta = (meta?: StoryDramaticMeta, labelPrefix = '') => {
    if (!meta) return null;
    const hasContent =
      meta.incitingIncident ||
      meta.climax ||
      meta.subtext ||
      (meta.setupForeshadowing && meta.setupForeshadowing.length > 0) ||
      (meta.payoff && meta.payoff.length > 0) ||
      (meta.characterArcs && meta.characterArcs.length > 0);

    if (!hasContent) return null;

    return (
      <div className="story-dramatic-meta-card card" style={{ marginTop: 8, padding: '8px 12px', background: '#f8fafc', borderLeft: '3px solid #3b82f6', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#1e3a8a', marginBottom: 4 }}>
          <Sparkles size={14} />
          <span>{labelPrefix} Dramatic & Continuity Notes</span>
        </div>
        {meta.incitingIncident && (
          <div style={{ marginTop: 2 }}>
            <strong>Inciting Incident: </strong>
            <span>{meta.incitingIncident}</span>
          </div>
        )}
        {meta.climax && (
          <div style={{ marginTop: 2 }}>
            <strong>Climax: </strong>
            <span>{meta.climax}</span>
          </div>
        )}
        {meta.subtext && (
          <div style={{ marginTop: 2 }}>
            <strong>Subtext: </strong>
            <span style={{ fontStyle: 'italic' }}>{meta.subtext}</span>
          </div>
        )}
        {meta.setupForeshadowing && meta.setupForeshadowing.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <strong>Setup & Foreshadowing: </strong>
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginLeft: 4 }}>
              {meta.setupForeshadowing.map((item, idx) => (
                <span key={idx} className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {meta.payoff && meta.payoff.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <strong>Payoffs: </strong>
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginLeft: 4 }}>
              {meta.payoff.map((item, idx) => (
                <span key={idx} className="badge" style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem' }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {meta.characterArcs && meta.characterArcs.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <strong>Character Arcs: </strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {meta.characterArcs.map((arc, idx) => (
                <li key={idx}>
                  <code>{arc.characterAssetId}</code>: {arc.arcState}{' '}
                  {arc.internalShift && <span style={{ color: '#475569' }}>({arc.internalShift})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="story-creator-mode-tree" data-testid="story-creator-mode">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Creator Mode Breakdown</h3>
          <p className="muted-text" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Structured 4-tier narrative hierarchy: Act &rarr; Sequence &rarr; Scene &rarr; Beat
          </p>
        </div>
      </div>

      {acts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="muted-text">No acts have been outlined yet for this story.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {acts.map((act, actIdx) => {
            const isActOpen = expandedNodes[act.id] ?? true;
            return (
              <div key={act.id} className="card story-act-node" style={{ border: '1px solid #cbd5e1', padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleExpand(act.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="icon-btn" style={{ padding: 2 }} aria-label={isActOpen ? 'Collapse act' : 'Expand act'}>
                      {isActOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span className="badge badge-primary" style={{ fontWeight: 700 }}>Act {actIdx + 1}</span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{act.title}</h4>
                  </div>
                </div>

                {act.summary && (
                  <p style={{ margin: '8px 0 0 28px', color: '#334155', fontSize: '0.9rem' }}>{act.summary}</p>
                )}
                <div style={{ marginLeft: 28 }}>
                  {renderDramaticMeta(act.dramaticMeta, 'Act')}
                </div>

                {isActOpen && (
                  <div style={{ marginTop: 16, marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {act.sequences.map((seq, seqIdx) => {
                      const isSeqOpen = expandedNodes[seq.id] ?? true;
                      return (
                        <div key={seq.id} className="story-seq-node" style={{ background: '#f1f5f9', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleExpand(seq.id)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" className="icon-btn" style={{ padding: 2 }}>
                                {isSeqOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <span className="badge" style={{ background: '#64748b', color: '#fff' }}>Seq {seqIdx + 1}</span>
                              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{seq.title}</h5>
                            </div>
                          </div>

                          {seq.summary && (
                            <p style={{ margin: '6px 0 0 24px', color: '#475569', fontSize: '0.85rem' }}>{seq.summary}</p>
                          )}
                          <div style={{ marginLeft: 24 }}>
                            {renderDramaticMeta(seq.dramaticMeta, 'Sequence')}
                          </div>

                          {isSeqOpen && (
                            <div style={{ marginTop: 12, marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {seq.scenes.map((scene, scIdx) => {
                                const isSceneOpen = expandedNodes[scene.id] ?? true;
                                return (
                                  <div key={scene.id} className="story-scene-node" style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleExpand(scene.id)}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button type="button" className="icon-btn" style={{ padding: 2 }}>
                                          {isSceneOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span className="badge badge-outline">Scene {scIdx + 1}</span>
                                        <h6 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{scene.title}</h6>
                                      </div>
                                      {((scene.linkedShotIds && scene.linkedShotIds.length > 0) || scene.linkedSceneId) && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          {scene.linkedShotIds && scene.linkedShotIds.length > 0 && (
                                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem' }}>
                                              <Clapperboard size={10} style={{ marginRight: 2 }} /> {scene.linkedShotIds.length} Shot(s)
                                            </span>
                                          )}
                                          {scene.linkedSceneId && (
                                            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>
                                              <Film size={10} style={{ marginRight: 2 }} /> Scene
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {scene.summary && (
                                      <p style={{ margin: '4px 0 0 20px', color: '#475569', fontSize: '0.85rem' }}>{scene.summary}</p>
                                    )}
                                    <div style={{ marginLeft: 20 }}>
                                      {renderDramaticMeta(scene.dramaticMeta, 'Scene')}
                                    </div>

                                    {isSceneOpen && (
                                      <div style={{ marginTop: 8, marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {scene.beats.map((beat, beatIdx) => (
                                          <div key={beat.id} className="story-beat-node card" style={{ padding: 8, background: '#fafafa', border: '1px dashed #cbd5e1', borderRadius: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="badge" style={{ fontSize: '0.7rem', background: '#e2e8f0' }}>Beat {beatIdx + 1}</span>
                                                <strong style={{ fontSize: '0.85rem' }}>{beat.title}</strong>
                                              </div>
                                            </div>
                                            {beat.content && (
                                              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#1e293b' }}>
                                                {beat.content}
                                              </p>
                                            )}
                                            {renderDramaticMeta(beat.dramaticMeta, 'Beat')}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
