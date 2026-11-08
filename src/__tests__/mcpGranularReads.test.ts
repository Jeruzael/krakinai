import { describe, expect, it } from 'vitest';
import {
  readAssetDetail,
  readCatalogPresets,
  readExportedScenePrompts,
  readProjectContinuity,
  readSavedScenesList,
  readSceneAssemblyPreview,
  readSpatialContinuity,
} from '../domain/mcpGranularReads';
import { emptyMcpScope } from '../domain/mcpScope';
import type { ChangeSetState } from '../types/changeSet';
import { validatePerformanceDirection } from '../domain/dialoguePerformance';
import { VOICE_FIELDS } from '../domain/performanceCatalog';

const mockState: ChangeSetState = {
  collections: [
    {
      id: 'proj-1',
      name: 'Ep 1',
      description: 'Test',
      members: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      project: {
        version: 1,
        revision: 1,
        shots: [
          {
            id: 'shot-1',
            code: 'S01',
            title: 'Shot 1',
            order: 0,
            takeSceneIds: ['scene-1'],
            selectedSceneId: 'scene-1',
            status: 'planned',
          },
        ],
      },
    },
  ],
  assets: [
    {
      id: 'char-1',
      category: 'characters',
      kind: 'asset',
      title: 'Silvester',
      promptText: 'Secret prompt text',
      compactText: 'Silver tabby',
      description: 'Main cat',
      tags: ['cat'],
      notes: 'Private note',
      isFavorite: true,
      revision: 1,
      identityRevision: 1,
      identityAnchor: {
        status: 'approved',
        immutableTraits: 'Amber eyes, nicked ear',
        prohibitedDrift: 'No collar',
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
  ],
  variants: [
    {
      id: 'outfit-1',
      targetSlot: 'wardrobe',
      parentCharacterId: 'char-1',
      title: 'Winter Scarf',
      promptText: 'Knitted wool scarf',
      tags: ['winter'],
      revision: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      mediaLinks: [],
    } as any,
  ],
  scenes: [
    {
      id: 'scene-1',
      headId: 'scene-1',
      versionNumber: 1,
      title: 'S01 Take 1',
      authoringMode: 'recipe',
      shotType: 'character_scene',
      settings: { outputType: 'Video Prompts', quantity: 1, aspectRatio: '16:9', durationSeconds: 8 },
      slots: {
        character: {
          slot: 'character',
          sourceType: 'asset',
          sourceId: 'char-1',
          sourceRevision: 1,
          sourceTitle: 'Silvester',
          promptText: 'Silver tabby cat.',
        },
      },
      outputs: {
        full: 'Full assembled prompt for S01',
        structured: 'Full assembled prompt for S01',
        compact: 'Full assembled prompt for S01',
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
    {
      id: 'scene-archived',
      headId: 'scene-archived',
      versionNumber: 1,
      title: 'Old Archived Take',
      authoringMode: 'direct_prompt',
      shotType: 'character_scene',
      settings: { outputType: 'Video Prompts', quantity: 1, aspectRatio: '16:9', durationSeconds: 6 },
      slots: {},
      outputs: {
        full: 'Archived prompt',
        structured: 'Archived prompt',
        compact: 'Archived prompt',
      },
      archivedAt: '2026-02-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    } as any,
  ],
  templates: [],
  media: [],
  preferences: {} as any,
};

describe('mcpGranularReads', () => {
  it('redacts promptText, notes, and identityAnchor in readAssetDetail unless granted by scope', () => {
    const minScope = {
      ...emptyMcpScope(),
      assetIds: ['char-1'],
      variantIds: ['outfit-1'],
      includeAssetText: false,
      includeCharacterIdentity: false,
      includeNotes: false,
    };

    const redacted = readAssetDetail(mockState, minScope, { id: 'char-1' });
    expect(redacted.promptText).toBeUndefined();
    expect(redacted.notes).toBeUndefined();
    expect(redacted.identityAnchor).toEqual({ status: 'approved', redacted: true });
    expect((redacted.outfitVariants as Array<Record<string, unknown>>)[0].id).toBe('outfit-1');

    const fullScope = {
      ...minScope,
      includeAssetText: true,
      includeCharacterIdentity: true,
      includeNotes: true,
    };
    const full = readAssetDetail(mockState, fullScope, { id: 'char-1' });
    expect(full.promptText).toBe('Secret prompt text');
    expect(full.notes).toBe('Private note');
    expect((full.identityAnchor as Record<string, unknown>).immutableTraits).toBe('Amber eyes, nicked ear');
  });

  it('returns cinematography, performance, and shot_types presets from readCatalogPresets', () => {
    const cinema = readCatalogPresets({ catalog: 'cinematography' });
    expect(cinema.catalog).toBe('cinematography');
    expect(Array.isArray(cinema.shotSizes)).toBe(true);

    const perf = readCatalogPresets({ catalog: 'performance' });
    expect(perf.catalog).toBe('performance');
    expect(Array.isArray(perf.emotions)).toBe(true);

    const shotTypes = readCatalogPresets({ catalog: 'shot_types' });
    expect(shotTypes.catalog).toBe('shot_types');
    expect(Array.isArray(shotTypes.items)).toBe(true);
  });

  it('exposes every Performance Studio option ID for agents', () => {
    const r = readCatalogPresets({ catalog: 'performance' }) as any;
    expect(r.voiceOptions.texture.breathy).toBe('Breathy');
    expect(r.speechOptions.pauses.dramatic).toBe('Dramatic');
    expect(r.emotionGroups['Sad / Vulnerable'].heartbroken).toBe('Heartbroken');
    expect(r.techniqueOptions.laughing_while_speaking).toBe('Laughing while speaking');
    expect(r.gestureOptions.open_palm).toBe('Open-palm gestures');
    expect(validatePerformanceDirection(r.performanceDirectionExample)).toBeUndefined();
    expect(r.voiceFields).toEqual(Object.keys(VOICE_FIELDS)); // unchanged
  });

  it('filters saved scenes by archiveFilter and enforces fullPromptSceneIds on export', () => {
    const scope = {
      ...emptyMcpScope(),
      sceneIds: ['scene-1', 'scene-archived'],
      fullPromptSceneIds: ['scene-1'],
    };

    const activeOnly = readSavedScenesList(mockState, scope, { archiveFilter: 'active' });
    expect((activeOnly.items as Array<{ id: string }>).map((s) => s.id)).toEqual(['scene-1']);

    const archivedOnly = readSavedScenesList(mockState, scope, { archiveFilter: 'archived' });
    expect((archivedOnly.items as Array<{ id: string }>).map((s) => s.id)).toEqual(['scene-archived']);

    const exported = readExportedScenePrompts(mockState, scope, { sceneIds: ['scene-1'] });
    expect(exported.text).toContain('Full assembled prompt for S01');

    expect(() =>
      readExportedScenePrompts(mockState, scope, { sceneIds: ['scene-archived'] }),
    ).toThrow(/Full prompt disclosure is not enabled/i);
  });

  it('reads project continuity, spatial continuity, and scene assembly preview for authorized projects/scenes', () => {
    const scope = {
      ...emptyMcpScope(),
      projectIds: ['proj-1'],
      sceneIds: ['scene-1'],
      assetIds: ['char-1'],
    };

    const cont = readProjectContinuity(mockState, scope, { projectId: 'proj-1' });
    expect(cont.projectId).toBe('proj-1');
    expect(Array.isArray(cont.cast)).toBe(true);

    const spatial = readSpatialContinuity(mockState, scope, { projectId: 'proj-1' });
    expect(spatial.projectId).toBe('proj-1');
    expect(Array.isArray(spatial.findings)).toBe(true);

    const assembly = readSceneAssemblyPreview(mockState, scope, { sceneId: 'scene-1' });
    expect(assembly.sceneId).toBe('scene-1');
    expect(Array.isArray(assembly.preflightFindings)).toBe(true);
  });
});
