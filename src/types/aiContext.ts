export interface AiContextSelection {
  projectIds?: string[];
  sceneIds?: string[];
  assetIds?: string[];
  variantIds?: string[];
  templateIds?: string[];
  fullPromptSceneIds?: string[];
  includeAssetText?: boolean;
  includeCharacterIdentity?: boolean;
  includeNotes?: boolean;
  includeMediaFilenames?: boolean;
}
export interface AiContextScene {
  id: string;
  title?: string;
  missing?: true;
  authoringMode?: string;
  shotType?: string;
  rootSceneId?: string;
  expectedHeadId?: string;
  sequence?: number;
  fullPrompt?: string;
  [key: string]: unknown;
}
export interface AiContextDocument {
  schema: "krakinai.ai-context.v1";
  exportedAt: string;
  privacy: Record<string, boolean>;
  projects: Record<string, unknown>[];
  scenes: AiContextScene[];
  assets: Record<string, unknown>[];
  variants: Record<string, unknown>[];
  templates: Record<string, unknown>[];
}
