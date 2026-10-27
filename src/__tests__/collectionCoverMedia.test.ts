import { expect, it } from 'vitest';
import { getCollectionCoverMediaIds } from '../domain/collectionCoverMedia';
import { legacyScene } from './fixtures/legacyScene';
import type { Collection, PromptAsset, Variant } from '../types/domain';
it('derives selected results/references first, other takes, frames, cast and actual member IDs without name inference', () => {
  const scene = structuredClone(legacyScene);
  scene.resultMediaLinks = [
    { mediaId: 'result', role: 'result', order: 0, altText: '' },
  ];
  scene.references = [
    { mediaId: 'reference', role: 'reference', order: 0, altText: '' },
  ];
  const other = {
    ...structuredClone(scene),
    id: 'other',
    resultMediaLinks: [
      { mediaId: 'other-take', role: 'result' as const, order: 0, altText: '' },
    ],
  };
  const collection: Collection = {
    id: 'p',
    name: 'Same title',
    description: '',
    createdAt: '',
    updatedAt: '',
    members: [
      { type: 'asset', id: 'member', addedAt: '' },
      { type: 'variant', id: 'variant', addedAt: '' },
    ],
    coverMediaId: 'cover',
    project: {
      version: 1,
      revision: 1,
      shots: [
        {
          id: 'shot',
          code: '01',
          title: '',
          order: 0,
          takeSceneIds: [scene.id, other.id],
          selectedSceneId: scene.id,
          status: 'planned',
          firstFrameMediaId: 'first',
          lastFrameMediaId: 'last',
        },
      ],
      cast: [
        { characterId: 'character', referenceMediaIds: ['cast-reference'] },
      ],
    },
  };
  const assets = [
    {
      id: 'member',
      coverMediaId: 'member-cover',
      mediaLinks: [{ mediaId: 'member-media' }],
    },
    {
      id: 'unrelated',
      title: 'Same title',
      mediaLinks: [{ mediaId: 'unrelated-image' }],
    },
  ] as PromptAsset[];
  const variants = [
    { id: 'variant', mediaLinks: [{ mediaId: 'variant-image' }] },
  ] as Variant[];
  const before = structuredClone(collection),
    ids = getCollectionCoverMediaIds(collection, {
      assets,
      variants,
      scenes: [scene, other],
    });
  expect(ids.slice(0, 2)).toEqual(['result', 'reference']);
  expect(ids).toEqual(
    expect.arrayContaining([
      'other-take',
      'first',
      'last',
      'cast-reference',
      'cover',
      'member-cover',
      'member-media',
      'variant-image',
    ])
  );
  expect(ids).not.toContain('unrelated-image');
  expect(new Set(ids).size).toBe(ids.length);
  expect(collection).toEqual(before);
});
it('handles a new empty collection and missing legacy scene relationships without creating records', () => {
  expect(
    getCollectionCoverMediaIds(undefined, {
      assets: [],
      variants: [],
      scenes: [],
    })
  ).toEqual([]);
  expect(
    getCollectionCoverMediaIds(
      {
        id: 'p',
        name: '',
        description: '',
        createdAt: '',
        updatedAt: '',
        members: [{ type: 'scene', id: 'missing', addedAt: '' }],
      },
      { assets: [], variants: [], scenes: [] }
    )
  ).toEqual([]);
});
