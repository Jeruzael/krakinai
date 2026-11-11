import type { Story } from '../types/domain';
import type { ChangeSetState } from '../types/changeSet';
import { canonicalStringify } from './changeSetCanonical';

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Sync(text: string): string {
  const utf8Bytes: number[] = [];
  for (let ci = 0; ci < text.length; ci++) {
    let charcode = text.charCodeAt(ci);
    if (charcode < 0x80) {
      utf8Bytes.push(charcode);
    } else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    } else {
      ci++;
      charcode =
        0x10000 + (((charcode & 0x3ff) << 10) | (text.charCodeAt(ci) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const bitLength = utf8Bytes.length * 8;
  utf8Bytes.push(0x80);
  while (utf8Bytes.length % 64 !== 56) {
    utf8Bytes.push(0);
  }
  // 64-bit big endian length
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let b = 3; b >= 0; b--) {
    utf8Bytes.push((highBits >>> (b * 8)) & 0xff);
  }
  for (let b = 3; b >= 0; b--) {
    utf8Bytes.push((lowBits >>> (b * 8)) & 0xff);
  }

  const words: number[] = [];
  for (let bi = 0; bi < utf8Bytes.length; bi += 4) {
    words.push(
      (utf8Bytes[bi] << 24) |
        (utf8Bytes[bi + 1] << 16) |
        (utf8Bytes[bi + 2] << 8) |
        utf8Bytes[bi + 3]
    );
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f0, 0xc67178f2,
  ];

  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    for (let j = 0; j < 16; j++) {
      w[j] = words[i + j];
    }
    for (let j = 16; j < 64; j++) {
      const s0 =
        rightRotate(w[j - 15], 7) ^
        rightRotate(w[j - 15], 18) ^
        (w[j - 15] >>> 3);
      const s1 =
        rightRotate(w[j - 2], 17) ^
        rightRotate(w[j - 2], 19) ^
        (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let j = 0; j < 64; j++) {
      const S1 =
        rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 =
        rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

export function storyDigestProjection(story: Story): unknown {
  return {
    title: story.title,
    author: story.author,
    tags: [...story.tags].sort(),
    coverMediaId: story.coverMediaId ?? null,
    heroBannerMediaId: story.heroBannerMediaId ?? null,
    logline: story.logline,
    premise: story.premise,
    synopsis: story.synopsis,
    treatment: story.treatment,
    fullBookText: story.fullBookText,
    referencePack: {
      assetIds: [...story.referencePack.assetIds].sort(),
      variantIds: [...story.referencePack.variantIds].sort(),
      mediaIds: [...story.referencePack.mediaIds].sort(),
    },
    linkedCollectionId: story.linkedCollectionId ?? null,
    colorScript: story.colorScript,
    acts: story.acts,
    directorBriefing: story.directorBriefing ? {
      pacingAuditSummary: story.directorBriefing.pacingAuditSummary ?? null,
      continuityLocks: story.directorBriefing.continuityLocks ?? [],
      lightingProgression: story.directorBriefing.lightingProgression ?? [],
      actionArchetypes: story.directorBriefing.actionArchetypes ?? [],
      vocalRegister: story.directorBriefing.vocalRegister ?? [],
    } : null,
  };
}

export function computeStoryDigest(story: Story): string {
  const canonical = canonicalStringify(storyDigestProjection(story));
  return sha256Sync(canonical);
}

export function validateStoryInput(story: Story): void {
  if (!story || typeof story !== 'object') {
    throw new Error('Story object is required.');
  }
  if (!story.id || typeof story.id !== 'string') {
    throw new Error('Valid story ID is required.');
  }
  if (!story.title || typeof story.title !== 'string' || !story.title.trim()) {
    throw new Error('Story title is required and cannot be empty.');
  }

  if (Array.isArray(story.acts)) {
    for (const act of story.acts) {
      if (typeof act.orderIndex !== 'number' || act.orderIndex < 0) {
        throw new Error(`Act orderIndex must be non-negative. Got ${act.orderIndex}.`);
      }
      if (!act.title || !act.title.trim()) {
        throw new Error('Act title is required.');
      }
      if (Array.isArray(act.sequences)) {
        for (const seq of act.sequences) {
          if (typeof seq.orderIndex !== 'number' || seq.orderIndex < 0) {
            throw new Error(`Sequence orderIndex must be non-negative. Got ${seq.orderIndex}.`);
          }
          if (!seq.title || !seq.title.trim()) {
            throw new Error('Sequence title is required.');
          }
          if (Array.isArray(seq.scenes)) {
            for (const sc of seq.scenes) {
              if (typeof sc.orderIndex !== 'number' || sc.orderIndex < 0) {
                throw new Error(`Scene node orderIndex must be non-negative. Got ${sc.orderIndex}.`);
              }
              if (!sc.title || !sc.title.trim()) {
                throw new Error('Scene node title is required.');
              }
              if (Array.isArray(sc.beats)) {
                for (const beat of sc.beats) {
                  if (typeof beat.orderIndex !== 'number' || beat.orderIndex < 0) {
                    throw new Error(`Beat orderIndex must be non-negative. Got ${beat.orderIndex}.`);
                  }
                  if (!beat.title || !beat.title.trim()) {
                    throw new Error('Beat title is required.');
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(story.colorScript)) {
    for (const cs of story.colorScript) {
      if (typeof cs.orderIndex !== 'number' || cs.orderIndex < 0) {
        throw new Error(`Color script orderIndex must be non-negative. Got ${cs.orderIndex}.`);
      }
      if (!cs.label || !cs.label.trim()) {
        throw new Error('Color script label is required.');
      }
    }
  }

  if (story.directorBriefing) {
    if (typeof story.directorBriefing !== 'object') {
      throw new Error('Director briefing must be an object.');
    }
    const { continuityLocks, lightingProgression, actionArchetypes, vocalRegister } = story.directorBriefing;
    if (continuityLocks && !Array.isArray(continuityLocks)) {
      throw new Error('Director briefing continuityLocks must be an array.');
    }
    if (lightingProgression && !Array.isArray(lightingProgression)) {
      throw new Error('Director briefing lightingProgression must be an array.');
    }
    if (actionArchetypes && !Array.isArray(actionArchetypes)) {
      throw new Error('Director briefing actionArchetypes must be an array.');
    }
    if (vocalRegister && !Array.isArray(vocalRegister)) {
      throw new Error('Director briefing vocalRegister must be an array.');
    }
  }
}

export function validateStoryReferences(
  story: Story,
  state: ChangeSetState
): string[] {
  const warnings: string[] = [];

  const assetIds = new Set(state.assets.map((a) => a.id));
  const variantIds = new Set((state.variants ?? []).map((v) => v.id));
  const mediaIds = new Set((state.media ?? []).map((m) => m.id));
  const collectionIds = new Set((state.collections ?? []).map((c) => c.id));

  for (const id of story.referencePack?.assetIds ?? []) {
    if (!assetIds.has(id)) {
      warnings.push(`Referenced asset '${id}' was not found in the library.`);
    }
  }

  for (const id of story.referencePack?.variantIds ?? []) {
    if (!variantIds.has(id)) {
      warnings.push(`Referenced variant '${id}' was not found in the library.`);
    }
  }

  for (const id of story.referencePack?.mediaIds ?? []) {
    if (!mediaIds.has(id)) {
      warnings.push(`Referenced media '${id}' was not found in the media vault.`);
    }
  }

  if (story.coverMediaId && !mediaIds.has(story.coverMediaId)) {
    warnings.push(`Cover media '${story.coverMediaId}' was not found in the media vault.`);
  }

  if (story.heroBannerMediaId && !mediaIds.has(story.heroBannerMediaId)) {
    warnings.push(`Hero banner media '${story.heroBannerMediaId}' was not found in the media vault.`);
  }

  if (story.linkedCollectionId && !collectionIds.has(story.linkedCollectionId)) {
    warnings.push(
      `Referenced linked collection '${story.linkedCollectionId}' was not found in collections.`
    );
  }

  for (const cs of story.colorScript ?? []) {
    if (cs.mediaId && !mediaIds.has(cs.mediaId)) {
      warnings.push(`Color script entry '${cs.id}' media '${cs.mediaId}' was not found.`);
    }
    if (cs.lightingAssetId && !assetIds.has(cs.lightingAssetId)) {
      warnings.push(`Color script entry '${cs.id}' lighting asset '${cs.lightingAssetId}' was not found.`);
    }
    if (cs.styleAssetId && !assetIds.has(cs.styleAssetId)) {
      warnings.push(`Color script entry '${cs.id}' style asset '${cs.styleAssetId}' was not found.`);
    }
  }

  return warnings;
}
