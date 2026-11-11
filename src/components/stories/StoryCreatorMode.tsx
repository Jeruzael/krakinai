import React, { useState } from 'react';
import type { StoryAct, StorySequence, StorySceneNode, StoryBeat, StoryDramaticMeta } from '../../types/domain';
import { generateId } from '../../storage/db';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  Film,
  Clapperboard,
  Sparkles,
  X,
  Check,
} from 'lucide-react';

export interface StoryCreatorModeProps {
  acts: StoryAct[];
  onUpdateActs?: (acts: StoryAct[]) => void;
  readOnly?: boolean;
}

interface EditingNode {
  kind: 'act' | 'sequence' | 'scene' | 'beat';
  mode: 'add' | 'edit';
  actId?: string;
  seqId?: string;
  sceneId?: string;
  targetId?: string;
  title: string;
  summaryOrContent: string;
  incitingIncident: string;
  climax: string;
  subtext: string;
  setupForeshadowing: string;
  payoff: string;
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

  const [editingNode, setEditingNode] = useState<EditingNode | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Node opening helpers
  const openAddAct = () => {
    setEditingNode({
      kind: 'act',
      mode: 'add',
      title: `Act ${acts.length + 1}`,
      summaryOrContent: '',
      incitingIncident: '',
      climax: '',
      subtext: '',
      setupForeshadowing: '',
      payoff: '',
    });
  };

  const openEditAct = (act: StoryAct) => {
    setEditingNode({
      kind: 'act',
      mode: 'edit',
      targetId: act.id,
      title: act.title,
      summaryOrContent: act.summary || '',
      incitingIncident: act.dramaticMeta?.incitingIncident || '',
      climax: act.dramaticMeta?.climax || '',
      subtext: act.dramaticMeta?.subtext || '',
      setupForeshadowing: (act.dramaticMeta?.setupForeshadowing || []).join(', '),
      payoff: (act.dramaticMeta?.payoff || []).join(', '),
    });
  };

  const openAddSequence = (actId: string) => {
    const act = acts.find((a) => a.id === actId);
    setEditingNode({
      kind: 'sequence',
      mode: 'add',
      actId,
      title: `Sequence ${(act?.sequences.length || 0) + 1}`,
      summaryOrContent: '',
      incitingIncident: '',
      climax: '',
      subtext: '',
      setupForeshadowing: '',
      payoff: '',
    });
  };

  const openEditSequence = (seq: StorySequence, actId: string) => {
    setEditingNode({
      kind: 'sequence',
      mode: 'edit',
      actId,
      targetId: seq.id,
      title: seq.title,
      summaryOrContent: seq.summary || '',
      incitingIncident: seq.dramaticMeta?.incitingIncident || '',
      climax: seq.dramaticMeta?.climax || '',
      subtext: seq.dramaticMeta?.subtext || '',
      setupForeshadowing: (seq.dramaticMeta?.setupForeshadowing || []).join(', '),
      payoff: (seq.dramaticMeta?.payoff || []).join(', '),
    });
  };

  const openAddScene = (seqId: string, actId: string) => {
    const act = acts.find((a) => a.id === actId);
    const seq = act?.sequences.find((s) => s.id === seqId);
    setEditingNode({
      kind: 'scene',
      mode: 'add',
      actId,
      seqId,
      title: `Scene ${(seq?.scenes.length || 0) + 1}`,
      summaryOrContent: '',
      incitingIncident: '',
      climax: '',
      subtext: '',
      setupForeshadowing: '',
      payoff: '',
    });
  };

  const openEditScene = (scene: StorySceneNode, seqId: string, actId: string) => {
    setEditingNode({
      kind: 'scene',
      mode: 'edit',
      actId,
      seqId,
      targetId: scene.id,
      title: scene.title,
      summaryOrContent: scene.summary || '',
      incitingIncident: scene.dramaticMeta?.incitingIncident || '',
      climax: scene.dramaticMeta?.climax || '',
      subtext: scene.dramaticMeta?.subtext || '',
      setupForeshadowing: (scene.dramaticMeta?.setupForeshadowing || []).join(', '),
      payoff: (scene.dramaticMeta?.payoff || []).join(', '),
    });
  };

  const openAddBeat = (sceneId: string, seqId: string, actId: string) => {
    const act = acts.find((a) => a.id === actId);
    const seq = act?.sequences.find((s) => s.id === seqId);
    const scene = seq?.scenes.find((sc) => sc.id === sceneId);
    setEditingNode({
      kind: 'beat',
      mode: 'add',
      actId,
      seqId,
      sceneId,
      title: `Beat ${(scene?.beats.length || 0) + 1}`,
      summaryOrContent: '',
      incitingIncident: '',
      climax: '',
      subtext: '',
      setupForeshadowing: '',
      payoff: '',
    });
  };

  const openEditBeat = (beat: StoryBeat, sceneId: string, seqId: string, actId: string) => {
    setEditingNode({
      kind: 'beat',
      mode: 'edit',
      actId,
      seqId,
      sceneId,
      targetId: beat.id,
      title: beat.title,
      summaryOrContent: beat.content || '',
      incitingIncident: beat.dramaticMeta?.incitingIncident || '',
      climax: beat.dramaticMeta?.climax || '',
      subtext: beat.dramaticMeta?.subtext || '',
      setupForeshadowing: (beat.dramaticMeta?.setupForeshadowing || []).join(', '),
      payoff: (beat.dramaticMeta?.payoff || []).join(', '),
    });
  };

  // Node Deletion helpers
  const handleDeleteAct = (actId: string) => {
    if (!onUpdateActs) return;
    const nextActs = acts
      .filter((a) => a.id !== actId)
      .map((a, idx) => ({ ...a, orderIndex: idx }));
    onUpdateActs(nextActs);
  };

  const handleDeleteSequence = (actId: string, seqId: string) => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const nextSeqs = act.sequences
        .filter((s) => s.id !== seqId)
        .map((s, idx) => ({ ...s, orderIndex: idx }));
      return { ...act, sequences: nextSeqs };
    });
    onUpdateActs(nextActs);
  };

  const handleDeleteScene = (actId: string, seqId: string, sceneId: string) => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const nextSeqs = act.sequences.map((seq) => {
        if (seq.id !== seqId) return seq;
        const nextScenes = seq.scenes
          .filter((sc) => sc.id !== sceneId)
          .map((sc, idx) => ({ ...sc, orderIndex: idx }));
        return { ...seq, scenes: nextScenes };
      });
      return { ...act, sequences: nextSeqs };
    });
    onUpdateActs(nextActs);
  };

  const handleDeleteBeat = (actId: string, seqId: string, sceneId: string, beatId: string) => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const nextSeqs = act.sequences.map((seq) => {
        if (seq.id !== seqId) return seq;
        const nextScenes = seq.scenes.map((sc) => {
          if (sc.id !== sceneId) return sc;
          const nextBeats = sc.beats
            .filter((b) => b.id !== beatId)
            .map((b, idx) => ({ ...b, orderIndex: idx }));
          return { ...sc, beats: nextBeats };
        });
        return { ...seq, scenes: nextScenes };
      });
      return { ...act, sequences: nextSeqs };
    });
    onUpdateActs(nextActs);
  };

  // Save handler from node edit/add dialog
  const handleSaveNode = () => {
    if (!editingNode || !onUpdateActs) return;
    const {
      kind,
      mode,
      actId,
      seqId,
      sceneId,
      targetId,
      title,
      summaryOrContent,
      incitingIncident,
      climax,
      subtext,
      setupForeshadowing,
      payoff,
    } = editingNode;

    const dramaticMeta: StoryDramaticMeta = {
      ...(incitingIncident.trim() ? { incitingIncident: incitingIncident.trim() } : {}),
      ...(climax.trim() ? { climax: climax.trim() } : {}),
      ...(subtext.trim() ? { subtext: subtext.trim() } : {}),
      ...(setupForeshadowing.trim()
        ? {
            setupForeshadowing: setupForeshadowing
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : {}),
      ...(payoff.trim()
        ? {
            payoff: payoff
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : {}),
    };

    let nextActs = [...acts];

    if (kind === 'act') {
      if (mode === 'add') {
        const newAct: StoryAct = {
          id: generateId('act'),
          orderIndex: nextActs.length,
          title: title.trim() || `Act ${nextActs.length + 1}`,
          summary: summaryOrContent.trim(),
          sequences: [],
          dramaticMeta,
        };
        nextActs.push(newAct);
        setExpandedNodes((prev) => ({ ...prev, [newAct.id]: true }));
      } else {
        nextActs = nextActs.map((a) =>
          a.id === targetId
            ? {
                ...a,
                title: title.trim() || a.title,
                summary: summaryOrContent.trim(),
                dramaticMeta,
              }
            : a
        );
      }
    } else if (kind === 'sequence' && actId) {
      nextActs = nextActs.map((act) => {
        if (act.id !== actId) return act;
        let nextSeqs = [...act.sequences];
        if (mode === 'add') {
          const newSeq: StorySequence = {
            id: generateId('seq'),
            orderIndex: nextSeqs.length,
            title: title.trim() || `Sequence ${nextSeqs.length + 1}`,
            summary: summaryOrContent.trim(),
            scenes: [],
            dramaticMeta,
          };
          nextSeqs.push(newSeq);
          setExpandedNodes((prev) => ({ ...prev, [newSeq.id]: true }));
        } else {
          nextSeqs = nextSeqs.map((s) =>
            s.id === targetId
              ? {
                  ...s,
                  title: title.trim() || s.title,
                  summary: summaryOrContent.trim(),
                  dramaticMeta,
                }
              : s
          );
        }
        return { ...act, sequences: nextSeqs };
      });
    } else if (kind === 'scene' && actId && seqId) {
      nextActs = nextActs.map((act) => {
        if (act.id !== actId) return act;
        const nextSeqs = act.sequences.map((seq) => {
          if (seq.id !== seqId) return seq;
          let nextScenes = [...seq.scenes];
          if (mode === 'add') {
            const newScene: StorySceneNode = {
              id: generateId('scene'),
              orderIndex: nextScenes.length,
              title: title.trim() || `Scene ${nextScenes.length + 1}`,
              summary: summaryOrContent.trim(),
              beats: [],
              dramaticMeta,
            };
            nextScenes.push(newScene);
            setExpandedNodes((prev) => ({ ...prev, [newScene.id]: true }));
          } else {
            nextScenes = nextScenes.map((sc) =>
              sc.id === targetId
                ? {
                    ...sc,
                    title: title.trim() || sc.title,
                    summary: summaryOrContent.trim(),
                    dramaticMeta,
                  }
                : sc
            );
          }
          return { ...seq, scenes: nextScenes };
        });
        return { ...act, sequences: nextSeqs };
      });
    } else if (kind === 'beat' && actId && seqId && sceneId) {
      nextActs = nextActs.map((act) => {
        if (act.id !== actId) return act;
        const nextSeqs = act.sequences.map((seq) => {
          if (seq.id !== seqId) return seq;
          const nextScenes = seq.scenes.map((sc) => {
            if (sc.id !== sceneId) return sc;
            let nextBeats = [...sc.beats];
            if (mode === 'add') {
              const newBeat: StoryBeat = {
                id: generateId('beat'),
                orderIndex: nextBeats.length,
                title: title.trim() || `Beat ${nextBeats.length + 1}`,
                content: summaryOrContent.trim(),
                dramaticMeta,
              };
              nextBeats.push(newBeat);
            } else {
              nextBeats = nextBeats.map((b) =>
                b.id === targetId
                  ? {
                      ...b,
                      title: title.trim() || b.title,
                      content: summaryOrContent.trim(),
                      dramaticMeta,
                    }
                  : b
              );
            }
            return { ...sc, beats: nextBeats };
          });
          return { ...seq, scenes: nextScenes };
        });
        return { ...act, sequences: nextSeqs };
      });
    }

    onUpdateActs(nextActs);
    setEditingNode(null);
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
      <div
        className="story-dramatic-meta-card card"
        style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#f8fafc',
          borderLeft: '3px solid #3b82f6',
          fontSize: '0.85rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
            color: '#1e3a8a',
            marginBottom: 4,
          }}
        >
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
                <span
                  key={idx}
                  className="badge"
                  style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}
                >
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
                <span
                  key={idx}
                  className="badge"
                  style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem' }}
                >
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Creator Mode Breakdown</h3>
          <p className="muted-text" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Structured 4-tier narrative hierarchy: Act &rarr; Sequence &rarr; Scene &rarr; Beat
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openAddAct}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            <span>Add Act</span>
          </button>
        )}
      </div>

      {acts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="muted-text">No acts have been outlined yet for this story.</p>
          {!readOnly && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openAddAct}
              style={{ marginTop: 12 }}
            >
              + Create First Act
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {acts.map((act, actIdx) => {
            const isActOpen = expandedNodes[act.id] ?? true;
            return (
              <div
                key={act.id}
                className="card story-act-node"
                style={{ border: '1px solid #cbd5e1', padding: 16, borderRadius: 8 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => toggleExpand(act.id)}
                  >
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ padding: 2 }}
                      aria-label={isActOpen ? 'Collapse act' : 'Expand act'}
                    >
                      {isActOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                      Act {actIdx + 1}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{act.title}</h4>
                  </div>

                  {!readOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openAddSequence(act.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                      >
                        <Plus size={12} />
                        <span>Add Sequence</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEditAct(act)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                      >
                        <Edit3 size={12} />
                        <span>Edit Act</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDeleteAct(act.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          color: '#ef4444',
                        }}
                      >
                        <Trash2 size={12} />
                        <span>Delete Act</span>
                      </button>
                    </div>
                  )}
                </div>

                {act.summary && (
                  <p style={{ margin: '8px 0 0 28px', color: '#334155', fontSize: '0.9rem' }}>
                    {act.summary}
                  </p>
                )}
                <div style={{ marginLeft: 28 }}>{renderDramaticMeta(act.dramaticMeta, 'Act')}</div>

                {isActOpen && (
                  <div
                    style={{
                      marginTop: 16,
                      marginLeft: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {act.sequences.map((seq, seqIdx) => {
                      const isSeqOpen = expandedNodes[seq.id] ?? true;
                      return (
                        <div
                          key={seq.id}
                          className="story-seq-node"
                          style={{
                            background: '#f1f5f9',
                            padding: 12,
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                              onClick={() => toggleExpand(seq.id)}
                            >
                              <button type="button" className="icon-btn" style={{ padding: 2 }}>
                                {isSeqOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <span className="badge" style={{ background: '#64748b', color: '#fff' }}>
                                Seq {seqIdx + 1}
                              </span>
                              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                                {seq.title}
                              </h5>
                            </div>

                            {!readOnly && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openAddScene(seq.id, act.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                                >
                                  <Plus size={12} />
                                  <span>Add Scene</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openEditSequence(seq, act.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                                >
                                  <Edit3 size={12} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleDeleteSequence(act.id, seq.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.75rem',
                                    color: '#ef4444',
                                  }}
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {seq.summary && (
                            <p style={{ margin: '6px 0 0 24px', color: '#475569', fontSize: '0.85rem' }}>
                              {seq.summary}
                            </p>
                          )}
                          <div style={{ marginLeft: 24 }}>
                            {renderDramaticMeta(seq.dramaticMeta, 'Sequence')}
                          </div>

                          {isSeqOpen && (
                            <div
                              style={{
                                marginTop: 12,
                                marginLeft: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              {seq.scenes.map((scene, scIdx) => {
                                const isSceneOpen = expandedNodes[scene.id] ?? true;
                                return (
                                  <div
                                    key={scene.id}
                                    className="story-scene-node"
                                    style={{
                                      background: '#ffffff',
                                      padding: 10,
                                      borderRadius: 6,
                                      border: '1px solid #cbd5e1',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => toggleExpand(scene.id)}
                                      >
                                        <button type="button" className="icon-btn" style={{ padding: 2 }}>
                                          {isSceneOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span className="badge badge-outline">Scene {scIdx + 1}</span>
                                        <h6 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                                          {scene.title}
                                        </h6>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {((scene.linkedShotIds && scene.linkedShotIds.length > 0) ||
                                          scene.linkedSceneId) && (
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            {scene.linkedShotIds && scene.linkedShotIds.length > 0 && (
                                              <span
                                                className="badge"
                                                style={{
                                                  background: '#e0f2fe',
                                                  color: '#0369a1',
                                                  fontSize: '0.75rem',
                                                }}
                                              >
                                                <Clapperboard size={10} style={{ marginRight: 2 }} />{' '}
                                                {scene.linkedShotIds.length} Shot(s)
                                              </span>
                                            )}
                                            {scene.linkedSceneId && (
                                              <span
                                                className="badge"
                                                style={{
                                                  background: '#fef3c7',
                                                  color: '#92400e',
                                                  fontSize: '0.75rem',
                                                }}
                                              >
                                                <Film size={10} style={{ marginRight: 2 }} /> Scene
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {!readOnly && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => openAddBeat(scene.id, seq.id, act.id)}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: '0.75rem',
                                              }}
                                            >
                                              <Plus size={12} />
                                              <span>Add Beat</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => openEditScene(scene, seq.id, act.id)}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: '0.75rem',
                                              }}
                                            >
                                              <Edit3 size={12} />
                                              <span>Edit</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => handleDeleteScene(act.id, seq.id, scene.id)}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: '0.75rem',
                                                color: '#ef4444',
                                              }}
                                            >
                                              <Trash2 size={12} />
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {scene.summary && (
                                      <p style={{ margin: '4px 0 0 20px', color: '#475569', fontSize: '0.85rem' }}>
                                        {scene.summary}
                                      </p>
                                    )}
                                    <div style={{ marginLeft: 20 }}>
                                      {renderDramaticMeta(scene.dramaticMeta, 'Scene')}
                                    </div>

                                    {isSceneOpen && (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          marginLeft: 20,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 6,
                                        }}
                                      >
                                        {scene.beats.map((beat, beatIdx) => (
                                          <div
                                            key={beat.id}
                                            className="story-beat-node card"
                                            style={{
                                              padding: 8,
                                              background: '#fafafa',
                                              border: '1px dashed #cbd5e1',
                                              borderRadius: 4,
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: 6,
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span
                                                  className="badge"
                                                  style={{ fontSize: '0.7rem', background: '#e2e8f0' }}
                                                >
                                                  Beat {beatIdx + 1}
                                                </span>
                                                <strong style={{ fontSize: '0.85rem' }}>{beat.title}</strong>
                                              </div>

                                              {!readOnly && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                  <button
                                                    type="button"
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() =>
                                                      openEditBeat(beat, scene.id, seq.id, act.id)
                                                    }
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: 2,
                                                      fontSize: '0.7rem',
                                                      padding: '2px 6px',
                                                    }}
                                                  >
                                                    <Edit3 size={11} />
                                                    <span>Edit</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() =>
                                                      handleDeleteBeat(act.id, seq.id, scene.id, beat.id)
                                                    }
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: 2,
                                                      fontSize: '0.7rem',
                                                      padding: '2px 6px',
                                                      color: '#ef4444',
                                                    }}
                                                  >
                                                    <Trash2 size={11} />
                                                    <span>Delete</span>
                                                  </button>
                                                </div>
                                              )}
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

      {/* Node Editing Dialog */}
      {editingNode && (
        <div className="modal-backdrop" onClick={() => setEditingNode(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label={`${editingNode.mode === 'add' ? 'Add' : 'Edit'} ${editingNode.kind}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 540,
              width: '92vw',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A' }}>
                {editingNode.mode === 'add' ? 'Add' : 'Edit'} {editingNode.kind.toUpperCase()}
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditingNode(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                maxHeight: '70vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: '#FFFFFF',
              }}
            >
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Title
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  value={editingNode.title}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, title: e.target.value })
                  }
                  placeholder={`Enter ${editingNode.kind} title...`}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {editingNode.kind === 'beat' ? 'Beat Action & Content' : 'Summary & Beat Notes'}
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  style={{ width: '100%' }}
                  value={editingNode.summaryOrContent}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, summaryOrContent: e.target.value })
                  }
                  placeholder={`Describe what happens in this ${editingNode.kind}...`}
                />
              </div>

              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e3a8a', fontWeight: 600, fontSize: '0.85rem' }}>
                  <Sparkles size={14} />
                  <span>Dramatic & Continuity Metadata</span>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 2 }}>
                    Subtext (Performance Delivery / Hidden Tension)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={editingNode.subtext}
                    onChange={(e) =>
                      setEditingNode({ ...editingNode, subtext: e.target.value })
                    }
                    placeholder="e.g. Kael masks his pain behind pack pride"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 2 }}>
                      Inciting Incident
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={editingNode.incitingIncident}
                      onChange={(e) =>
                        setEditingNode({ ...editingNode, incitingIncident: e.target.value })
                      }
                      placeholder="e.g. Broken spearhead discovered"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 2 }}>
                      Climax / Turning Point
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={editingNode.climax}
                      onChange={(e) =>
                        setEditingNode({ ...editingNode, climax: e.target.value })
                      }
                      placeholder="e.g. Garrick confronts Elowen"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 2 }}>
                    Setup & Foreshadowing (comma-separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={editingNode.setupForeshadowing}
                    onChange={(e) =>
                      setEditingNode({ ...editingNode, setupForeshadowing: e.target.value })
                    }
                    placeholder="e.g. Loose floorboard, Hidden medicinal vial"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 2 }}>
                    Payoffs (comma-separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={editingNode.payoff}
                    onChange={(e) =>
                      setEditingNode({ ...editingNode, payoff: e.target.value })
                    }
                    placeholder="e.g. Healer cellar trapdoor saves Kael"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingNode(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveNode}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Check size={14} />
                <span>Save {editingNode.kind.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
