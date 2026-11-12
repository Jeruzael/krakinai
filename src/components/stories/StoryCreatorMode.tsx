import React, { useState } from 'react';
import type { StoryAct, StorySequence, StorySceneNode, StoryBeat, StoryDramaticMeta } from '../../types/domain';
import type { CreatorModeSelection } from '../../types/qwen';
import { generateId } from '../../storage/db';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Film,
  Clapperboard,
  Sparkles,
  X,
  Check,
  Target,
} from 'lucide-react';

export interface StoryCreatorModeProps {
  acts: StoryAct[];
  onUpdateActs?: (acts: StoryAct[]) => void;
  readOnly?: boolean;
  selectedNode?: CreatorModeSelection;
  onSelectNode?: (selection: CreatorModeSelection) => void;
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
  selectedNode,
  onSelectNode,
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

  // Node Reordering helpers
  const handleMoveAct = (actId: string, direction: 'up' | 'down') => {
    if (!onUpdateActs) return;
    const index = acts.findIndex((a) => a.id === actId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= acts.length) return;
    const nextActs = [...acts];
    const [moved] = nextActs.splice(index, 1);
    nextActs.splice(targetIndex, 0, moved);
    onUpdateActs(nextActs.map((a, idx) => ({ ...a, orderIndex: idx })));
  };

  const handleMoveSequence = (actId: string, seqId: string, direction: 'up' | 'down') => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const index = act.sequences.findIndex((s) => s.id === seqId);
      if (index < 0) return act;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= act.sequences.length) return act;
      const nextSeqs = [...act.sequences];
      const [moved] = nextSeqs.splice(index, 1);
      nextSeqs.splice(targetIndex, 0, moved);
      return { ...act, sequences: nextSeqs.map((s, idx) => ({ ...s, orderIndex: idx })) };
    });
    onUpdateActs(nextActs);
  };

  const handleMoveScene = (actId: string, seqId: string, sceneId: string, direction: 'up' | 'down') => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const nextSeqs = act.sequences.map((seq) => {
        if (seq.id !== seqId) return seq;
        const index = seq.scenes.findIndex((sc) => sc.id === sceneId);
        if (index < 0) return seq;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= seq.scenes.length) return seq;
        const nextScenes = [...seq.scenes];
        const [moved] = nextScenes.splice(index, 1);
        nextScenes.splice(targetIndex, 0, moved);
        return { ...seq, scenes: nextScenes.map((sc, idx) => ({ ...sc, orderIndex: idx })) };
      });
      return { ...act, sequences: nextSeqs };
    });
    onUpdateActs(nextActs);
  };

  const handleMoveBeat = (actId: string, seqId: string, sceneId: string, beatId: string, direction: 'up' | 'down') => {
    if (!onUpdateActs) return;
    const nextActs = acts.map((act) => {
      if (act.id !== actId) return act;
      const nextSeqs = act.sequences.map((seq) => {
        if (seq.id !== seqId) return seq;
        const nextScenes = seq.scenes.map((sc) => {
          if (sc.id !== sceneId) return sc;
          const index = sc.beats.findIndex((b) => b.id === beatId);
          if (index < 0) return sc;
          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= sc.beats.length) return sc;
          const nextBeats = [...sc.beats];
          const [moved] = nextBeats.splice(index, 1);
          nextBeats.splice(targetIndex, 0, moved);
          return { ...sc, beats: nextBeats.map((b, idx) => ({ ...b, orderIndex: idx })) };
        });
        return { ...seq, scenes: nextScenes };
      });
      return { ...act, sequences: nextSeqs };
    });
    onUpdateActs(nextActs);
  };

  // Seed 3-Act Structure
  const handleSeed3ActStructure = () => {
    if (!onUpdateActs) return;
    const seeded: StoryAct[] = [
      {
        id: generateId('act'),
        orderIndex: 0,
        title: 'Act I: The Setup & Inciting Spark',
        summary: 'Establish the normal world, introduce the protagonist and core stakes, leading to the inciting incident.',
        dramaticMeta: {
          incitingIncident: 'A disruptive event forces the protagonist out of comfort',
          subtext: 'Internal tension between routine duty and unmet desire',
        },
        sequences: [
          {
            id: generateId('seq'),
            orderIndex: 0,
            title: 'Sequence 1: Ordinary World',
            summary: 'Daily life, core relationships, and flawed status quo.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 1: Introduction to Environment',
                summary: 'Protagonist navigates their standard environment under looming pressure.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: The Inciting Spark',
                    content: 'An unexpected encounter disrupts the routine.',
                  },
                ],
              },
            ],
          },
          {
            id: generateId('seq'),
            orderIndex: 1,
            title: 'Sequence 2: The First Threshold',
            summary: 'Consequences of the spark escalate until turning back is impossible.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 2: Crossing the Threshold',
                summary: 'Commitment to the journey; the rules of the new world apply.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: No Turning Back',
                    content: 'A definitive choice is made.',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: generateId('act'),
        orderIndex: 1,
        title: 'Act II: The Confrontation & Midpoint Reversal',
        summary: 'Rising stakes, trials, temporary triumphs, and a devastating midpoint reversal.',
        dramaticMeta: {
          subtext: 'Allies tested under duress; secrets surfaced',
          climax: 'Midpoint crisis forces a change in tactics',
        },
        sequences: [
          {
            id: generateId('seq'),
            orderIndex: 0,
            title: 'Sequence 3: Rising Pressure & Antagonism',
            summary: 'New obstacles appear; opposition demonstrates superiority.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 3: Direct Confrontation',
                summary: 'First clash between competing interests.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: Escalating Stakes',
                    content: 'The adversary retaliates unexpectedly.',
                  },
                ],
              },
            ],
          },
          {
            id: generateId('seq'),
            orderIndex: 1,
            title: 'Sequence 4: Midpoint Reversal',
            summary: 'A critical discovery changes the nature of the quest entirely.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 4: The Revelation',
                summary: 'The true stakes are revealed, rendering old strategies useless.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: False Victory or Catastrophe',
                    content: 'The ground shifts under everyone.',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: generateId('act'),
        orderIndex: 2,
        title: 'Act III: Climax & Resolution',
        summary: 'The darkest hour leads into the decisive showdown and establishing a new normal.',
        dramaticMeta: {
          climax: 'Decisive confrontation testing the core moral premise',
          payoff: ['All setup foreshadowing reaches fruition'],
        },
        sequences: [
          {
            id: generateId('seq'),
            orderIndex: 0,
            title: 'Sequence 5: The Final Standoff',
            summary: 'The inevitable confrontation where everything is on the line.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 5: Climax Peak',
                summary: 'The protagonist must make an ultimate sacrifice or definitive choice.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: Decisive Action',
                    content: 'The conflict reaches its definitive resolution.',
                  },
                ],
              },
            ],
          },
          {
            id: generateId('seq'),
            orderIndex: 1,
            title: 'Sequence 6: Resolution & New Equilibrium',
            summary: 'The dust settles and the new order is revealed.',
            scenes: [
              {
                id: generateId('scene'),
                orderIndex: 0,
                title: 'Scene 6: Final Resonance',
                summary: 'A lingering image or statement establishing the transformed world.',
                beats: [
                  {
                    id: generateId('beat'),
                    orderIndex: 0,
                    title: 'Beat 1: The New Horizon',
                    content: 'Quiet closure and future promise.',
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    onUpdateActs(seeded);
    const allIds: Record<string, boolean> = {};
    seeded.forEach((a) => {
      allIds[a.id] = true;
      a.sequences.forEach((s) => {
        allIds[s.id] = true;
        s.scenes.forEach((sc) => {
          allIds[sc.id] = true;
        });
      });
    });
    setExpandedNodes(allIds);
  };

  const allExpanded = acts.length > 0 && acts.every((a) => expandedNodes[a.id] !== false);

  const handleToggleAll = () => {
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    acts.forEach((a) => {
      updated[a.id] = nextState;
      a.sequences.forEach((s) => {
        updated[s.id] = nextState;
        s.scenes.forEach((sc) => {
          updated[sc.id] = nextState;
        });
      });
    });
    setExpandedNodes(updated);
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {acts.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleToggleAll}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {allExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

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
      </div>

      {acts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: 12, background: '#EFF6FF', color: '#2563EB', marginBottom: 12 }}>
            <Clapperboard size={32} />
          </div>
          <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#0F172A' }}>No Narrative Acts Outlined Yet</h4>
          <p className="muted-text" style={{ maxWidth: 520, margin: '0 auto 18px', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Creator Mode breaks down full narrative arcs into a production-ready 4-tier hierarchy:
            <strong> Act &rarr; Sequence &rarr; Scene &rarr; Beat</strong>. Connect narrative beats directly to shots and continuity.
          </p>
          {!readOnly && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openAddAct}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} />
                <span>+ Create First Act</span>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleSeed3ActStructure}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#FFFFFF',
                  borderColor: '#93C5FD',
                  color: '#1D4ED8',
                  fontWeight: 600,
                }}
              >
                <Sparkles size={14} />
                <span>Seed 3-Act Structure</span>
              </button>
            </div>
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
                    {onSelectNode && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode({ actId: act.id });
                        }}
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          background:
                            selectedNode?.actId === act.id && !selectedNode.sequenceId
                              ? '#10b981'
                              : '#f1f5f9',
                          color:
                            selectedNode?.actId === act.id && !selectedNode.sequenceId
                              ? '#ffffff'
                              : '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                        }}
                        title="Target this Act for Qwen Co-Pilot"
                      >
                        <Target size={11} />
                        <span>
                          {selectedNode?.actId === act.id && !selectedNode.sequenceId
                            ? 'Targeted'
                            : 'Target Qwen'}
                        </span>
                      </button>
                    )}
                  </div>

                  {!readOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleMoveAct(act.id, 'up')}
                        disabled={actIdx === 0}
                        title="Move Act Up"
                        aria-label="Move Up"
                        style={{ padding: '2px 6px', fontSize: '0.75rem', opacity: actIdx === 0 ? 0.4 : 1 }}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleMoveAct(act.id, 'down')}
                        disabled={actIdx === acts.length - 1}
                        title="Move Act Down"
                        aria-label="Move Down"
                        style={{ padding: '2px 6px', fontSize: '0.75rem', opacity: actIdx === acts.length - 1 ? 0.4 : 1 }}
                      >
                        <ChevronDown size={13} />
                      </button>
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
                              {onSelectNode && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectNode({ actId: act.id, sequenceId: seq.id });
                                  }}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '1px 5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    background:
                                      selectedNode?.sequenceId === seq.id && !selectedNode.sceneId
                                        ? '#10b981'
                                        : '#f8fafc',
                                    color:
                                      selectedNode?.sequenceId === seq.id && !selectedNode.sceneId
                                        ? '#ffffff'
                                        : '#64748b',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 4,
                                  }}
                                  title="Target this Sequence for Qwen Co-Pilot"
                                >
                                  <Target size={10} />
                                  <span>
                                    {selectedNode?.sequenceId === seq.id && !selectedNode.sceneId
                                      ? 'Targeted'
                                      : 'Target Qwen'}
                                  </span>
                                </button>
                              )}
                            </div>

                            {!readOnly && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleMoveSequence(act.id, seq.id, 'up')}
                                  disabled={seqIdx === 0}
                                  title="Move Sequence Up"
                                  aria-label="Move Up"
                                  style={{ padding: '2px 5px', fontSize: '0.72rem', opacity: seqIdx === 0 ? 0.4 : 1 }}
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleMoveSequence(act.id, seq.id, 'down')}
                                  disabled={seqIdx === act.sequences.length - 1}
                                  title="Move Sequence Down"
                                  aria-label="Move Down"
                                  style={{ padding: '2px 5px', fontSize: '0.72rem', opacity: seqIdx === act.sequences.length - 1 ? 0.4 : 1 }}
                                >
                                  <ChevronDown size={12} />
                                </button>
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
                                        {onSelectNode && (
                                          <button
                                            type="button"
                                            className="btn btn-sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSelectNode({
                                                actId: act.id,
                                                sequenceId: seq.id,
                                                sceneId: scene.id,
                                              });
                                            }}
                                            style={{
                                              fontSize: '0.68rem',
                                              padding: '1px 5px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 3,
                                              background:
                                                selectedNode?.sceneId === scene.id
                                                  ? '#10b981'
                                                  : '#f8fafc',
                                              color:
                                                selectedNode?.sceneId === scene.id
                                                  ? '#ffffff'
                                                  : '#64748b',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: 4,
                                            }}
                                            title="Target this Scene for Qwen Co-Pilot"
                                          >
                                            <Target size={10} />
                                            <span>
                                              {selectedNode?.sceneId === scene.id
                                                ? 'Targeted'
                                                : 'Target Qwen'}
                                            </span>
                                          </button>
                                        )}
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
                                              onClick={() => handleMoveScene(act.id, seq.id, scene.id, 'up')}
                                              disabled={scIdx === 0}
                                              title="Move Scene Up"
                                              aria-label="Move Up"
                                              style={{ padding: '2px 5px', fontSize: '0.72rem', opacity: scIdx === 0 ? 0.4 : 1 }}
                                            >
                                              <ChevronUp size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => handleMoveScene(act.id, seq.id, scene.id, 'down')}
                                              disabled={scIdx === seq.scenes.length - 1}
                                              title="Move Scene Down"
                                              aria-label="Move Down"
                                              style={{ padding: '2px 5px', fontSize: '0.72rem', opacity: scIdx === seq.scenes.length - 1 ? 0.4 : 1 }}
                                            >
                                              <ChevronDown size={12} />
                                            </button>
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
                                                    onClick={() => handleMoveBeat(act.id, seq.id, scene.id, beat.id, 'up')}
                                                    disabled={beatIdx === 0}
                                                    title="Move Beat Up"
                                                    aria-label="Move Up"
                                                    style={{ padding: '2px 5px', fontSize: '0.7rem', opacity: beatIdx === 0 ? 0.4 : 1 }}
                                                  >
                                                    <ChevronUp size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => handleMoveBeat(act.id, seq.id, scene.id, beat.id, 'down')}
                                                    disabled={beatIdx === scene.beats.length - 1}
                                                    title="Move Beat Down"
                                                    aria-label="Move Down"
                                                    style={{ padding: '2px 5px', fontSize: '0.7rem', opacity: beatIdx === scene.beats.length - 1 ? 0.4 : 1 }}
                                                  >
                                                    <ChevronDown size={11} />
                                                  </button>
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
            <div className="modal-header" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="badge"
                    style={{
                      background:
                        editingNode.kind === 'act'
                          ? '#EEF2FF'
                          : editingNode.kind === 'sequence'
                          ? '#F0F9FF'
                          : editingNode.kind === 'scene'
                          ? '#FFFBEB'
                          : '#ECFDF5',
                      color:
                        editingNode.kind === 'act'
                          ? '#4338CA'
                          : editingNode.kind === 'sequence'
                          ? '#0369A1'
                          : editingNode.kind === 'scene'
                          ? '#B45309'
                          : '#047857',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    {editingNode.kind === 'act'
                      ? 'Tier 1 • Narrative Arc'
                      : editingNode.kind === 'sequence'
                      ? 'Tier 2 • Sequence'
                      : editingNode.kind === 'scene'
                      ? 'Tier 3 • Scene'
                      : 'Tier 4 • Beat'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 700 }}>
                    {editingNode.mode === 'add' ? 'Add' : 'Edit'} {editingNode.kind.toUpperCase()}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                  {editingNode.kind === 'act'
                    ? 'Major narrative chapter, world shift, and thematic stakes'
                    : editingNode.kind === 'sequence'
                    ? 'Goal-driven group of scenes unified by immediate protagonist objective'
                    : editingNode.kind === 'scene'
                    ? 'Continuous dramatic interaction in a specific time and location'
                    : 'Smallest emotional turning point, dialogue cue, or physical gesture'}
                </p>
              </div>
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
