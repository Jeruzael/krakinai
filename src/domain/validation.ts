import type {
  BuilderSlot,
  PromptCategory,
  VariantType,
} from '../types/domain';

export const CATEGORY_TO_SLOT: Record<PromptCategory, BuilderSlot> = {
  characters: 'character',
  wardrobe: 'wardrobe',
  environments: 'environment',
  actions: 'action',
  camera: 'camera',
  lighting: 'lighting',
  styles: 'style',
};

export const SLOT_TO_CATEGORY: Record<BuilderSlot, PromptCategory> = {
  character: 'characters',
  wardrobe: 'wardrobe',
  environment: 'environments',
  action: 'actions',
  camera: 'camera',
  lighting: 'lighting',
  style: 'styles',
};

export const VARIANT_TYPE_TO_SLOT: Record<VariantType, BuilderSlot> = {
  Outfit: 'wardrobe',
  Expression: 'action',
  Pose: 'action',
  'Camera Angle': 'camera',
  Location: 'environment',
  'Visual Style': 'style',
};

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  characters: 'Characters',
  wardrobe: 'Clothing & Accessories',
  actions: 'Actions & Emotions',
  environments: 'Environments',
  camera: 'Camera & Movement',
  lighting: 'Lighting & Mood',
  styles: 'Art Styles',
};

export const SLOT_LABELS: Record<BuilderSlot, string> = {
  character: 'Character Identity',
  wardrobe: 'Clothing & Accessories',
  environment: 'Environment',
  action: 'Action & Emotion',
  camera: 'Camera & Movement',
  lighting: 'Lighting & Mood',
  style: 'Art Style',
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MiB
export const MAX_FILES_PER_RECORD = 6;
export const MAX_TOTAL_MEDIA_BYTES = 200 * 1024 * 1024; // 200 MiB
export const MAX_BACKUP_UNCOMPRESSED_BYTES = 250 * 1024 * 1024; // 250 MiB
export const MAX_BACKUP_ENTRIES = 2000;
export const MAX_MANIFEST_BYTES = 20 * 1024 * 1024; // 20 MiB

export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validatePromptAssetInput(input: {
  title: string;
  category?: PromptCategory;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  notes?: string;
  tags?: string[];
}): ValidationResult {
  const errors: Record<string, string> = {};
  const title = (input.title ?? '').trim();
  const promptText = (input.promptText ?? '').trim();
  const description = (input.description ?? '').trim();
  const compactText = (input.compactText ?? '').trim();
  const avoidText = (input.avoidText ?? '').trim();
  const notes = (input.notes ?? '').trim();
  const tags = input.tags ?? [];

  if (!title) {
    errors.title = 'Title is required.';
  } else if (title.length > 100) {
    errors.title = 'Title must be 100 characters or fewer.';
  }

  if (!input.category || !(input.category in CATEGORY_TO_SLOT)) {
    errors.category = 'Valid category is required.';
  }

  if (!promptText) {
    errors.promptText = 'Prompt text is required.';
  } else if (promptText.length > 12000) {
    errors.promptText = 'Prompt text must be 12,000 characters or fewer.';
  }

  if (description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer.';
  }

  if (compactText.length > 4000) {
    errors.compactText = 'Compact text must be 4,000 characters or fewer.';
  }

  if (avoidText.length > 4000) {
    errors.avoidText = 'Avoid text must be 4,000 characters or fewer.';
  }

  if (notes.length > 4000) {
    errors.notes = 'Notes must be 4,000 characters or fewer.';
  }

  if (tags.length > 12) {
    errors.tags = 'A maximum of 12 tags is allowed.';
  } else if (tags.some((t) => t.trim().length > 30 || t.trim().length === 0)) {
    errors.tags = 'Each tag must be between 1 and 30 characters.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateVariantInput(input: {
  parentCharacterId: string;
  type?: VariantType;
  title: string;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags?: string[];
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!(input.parentCharacterId ?? '').trim()) {
    errors.parentCharacterId = 'Parent character is required.';
  }
  if (!input.type || !(input.type in VARIANT_TYPE_TO_SLOT)) {
    errors.type = 'Valid variant type is required.';
  }
  const base = validatePromptAssetInput({
    title: input.title,
    category: 'characters',
    description: input.description,
    promptText: input.promptText,
    compactText: input.compactText,
    avoidText: input.avoidText,
    tags: input.tags,
  });
  Object.assign(errors, base.errors);
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCollectionInput(input: {
  name: string;
  description?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const name = (input.name ?? '').trim();
  const description = (input.description ?? '').trim();
  if (!name) {
    errors.name = 'Collection name is required.';
  } else if (name.length > 100) {
    errors.name = 'Collection name must be 100 characters or fewer.';
  }
  if (description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateMediaCandidate(params: {
  name: string;
  type: string;
  size: number;
  existingCount: number;
  currentTotalBytes?: number;
}): { valid: boolean; error?: string; kind?: 'image' | 'video' } {
  const { name, type, size, existingCount, currentTotalBytes = 0 } = params;
  if (existingCount >= MAX_FILES_PER_RECORD) {
    return {
      valid: false,
      error: `Maximum of 6 files per record reached (${name}).`,
    };
  }

  const lower = name.toLowerCase();
  const isImageExt = /\.(jpe?g|png|webp)$/.test(lower);
  const isVideoExt = /\.(mp4|webm)$/.test(lower);

  if (ALLOWED_IMAGE_MIMES.has(type) && isImageExt) {
    if (size <= 0) {
      return { valid: false, error: `${name}: File is empty.` };
    }
    if (size > MAX_IMAGE_BYTES) {
      return {
        valid: false,
        error: `${name}: Image exceeds the 10 MiB limit.`,
      };
    }
    if (currentTotalBytes + size > MAX_TOTAL_MEDIA_BYTES) {
      return {
        valid: false,
        error: `${name}: Upload would exceed the 200 MiB prototype media limit.`,
      };
    }
    return { valid: true, kind: 'image' };
  }

  if (ALLOWED_VIDEO_MIMES.has(type) && isVideoExt) {
    if (size <= 0) {
      return { valid: false, error: `${name}: File is empty.` };
    }
    if (size > MAX_VIDEO_BYTES) {
      return {
        valid: false,
        error: `${name}: Video exceeds the 50 MiB limit.`,
      };
    }
    if (currentTotalBytes + size > MAX_TOTAL_MEDIA_BYTES) {
      return {
        valid: false,
        error: `${name}: Upload would exceed the 200 MiB prototype media limit.`,
      };
    }
    return { valid: true, kind: 'video' };
  }

  return {
    valid: false,
    error: `${name}: Unsupported format. Accept JPEG, PNG, WebP (up to 10 MiB) or playable MP4/WebM (up to 50 MiB).`,
  };
}
