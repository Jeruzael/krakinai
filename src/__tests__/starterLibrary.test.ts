import { describe, expect, it } from 'vitest';
import {
  buildStarterLibraryBundle,
  getStarterTemplates,
} from '../domain/starterData';
import { CATEGORY_TO_SLOT, VARIANT_TYPE_TO_SLOT } from '../domain/validation';
import type { PromptCategory, VariantType } from '../types/domain';

describe('Starter Library & Starter Templates Specification', () => {
  it('provides four working starter templates that function independently of starter assets', () => {
    const templates = getStarterTemplates();
    expect(templates).toHaveLength(4);
    const names = templates.map((t) => t.name);
    expect(names).toEqual([
      'Talking to Camera',
      'Walking Scene',
      'Product Showcase',
      'Cinematic B-roll',
    ]);

    const talking = templates.find((t) => t.name === 'Talking to Camera')!;
    expect(talking.requiredSlots).toContain('character');
    expect(talking.requiredSlots).toContain('environment');
    expect(talking.requiredSlots).toContain('action');
    expect(talking.defaults.environment?.promptText.length).toBeGreaterThan(10);
    expect(talking.defaults.action?.promptText.length).toBeGreaterThan(10);

    const product = templates.find((t) => t.name === 'Product Showcase')!;
    expect(product.requiredSlots).not.toContain('character');
    expect(product.requiredSlots).toContain('environment');
    expect(product.requiredSlots).toContain('action');
  });

  it('builds 21 meaningful assets (3 per category), 6 Maya variants across all 6 types, 3 collections, and local bundled SVG media without remote URLs', () => {
    const bundle = buildStarterLibraryBundle();
    expect(bundle.assets).toHaveLength(21);

    const categories = Object.keys(CATEGORY_TO_SLOT) as PromptCategory[];
    for (const cat of categories) {
      const catAssets = bundle.assets.filter((a) => a.category === cat);
      expect(catAssets).toHaveLength(3);
      for (const a of catAssets) {
        expect(a.promptText.length).toBeGreaterThan(20);
        if (cat === 'characters') {
          expect(a.compactText).toBeUndefined();
        }
      }
    }

    expect(bundle.variants).toHaveLength(6);
    const maya = bundle.assets.find((a) => a.title.includes('Maya Santos'))!;
    expect(maya).toBeDefined();

    const variantTypes = Object.keys(VARIANT_TYPE_TO_SLOT) as VariantType[];
    for (const vType of variantTypes) {
      const match = bundle.variants.find((v) => v.type === vType);
      expect(match).toBeDefined();
      expect(match!.parentCharacterId).toBe(maya.id);
      expect(match!.targetSlot).toBe(VARIANT_TYPE_TO_SLOT[vType]);
    }

    expect(bundle.collections).toHaveLength(3);
    expect(bundle.collections.map((c) => c.name)).toEqual([
      'Drama Series',
      'Product Ads',
      'Character Pack',
    ]);

    expect(bundle.media.length).toBeGreaterThanOrEqual(27);
    for (const m of bundle.media) {
      expect(m.isBundledIllustration).toBe(true);
      expect(m.blob.size).toBeGreaterThan(50);
    }
  });
});
