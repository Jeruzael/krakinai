import type { ComponentSnapshot, PromptAsset, SceneGenerationChoice } from '../types/domain';

type IdentitySource = Pick<PromptAsset, 'identityRevision' | 'identityAnchor'> & { revision?: number; sourceRevision?: number };
export function getIdentityRevision(source: IdentitySource): number {
  return source.identityRevision ?? source.revision ?? source.sourceRevision ?? 1;
}
export function getIdentityAnchorStatus(source: IdentitySource): 'missing' | 'draft' | 'approved' | 'stale' {
  const anchor = source.identityAnchor;
  if (!anchor) return 'missing';
  if (!anchor.approvedText?.trim() || anchor.text !== anchor.approvedText || !anchor.approvedAt || !Number.isFinite(Date.parse(anchor.approvedAt))) return 'draft';
  return anchor.approvedMasterIdentityRevision === getIdentityRevision(source) ? 'approved' : 'stale';
}
export function resolveGenerationIdentity(
  source: { slots: { character?: ComponentSnapshot }; generation?: SceneGenerationChoice },
  liveMaster?: PromptAsset,
  saved = false
): { identity: { source: 'master' | 'approved_anchor'; description: string }; generation?: SceneGenerationChoice; reason?: string } {
  const character = source.slots.character;
  const master = { source: 'master' as const, description: character?.promptText ?? '' };
  const choice = source.generation;
  if (choice?.identitySource !== 'approved_anchor') return { identity: master, generation: choice ? structuredClone(choice) : undefined, reason: choice?.fallbackReason };
  const anchor = choice.anchor;
  let reason: string | undefined;
  if (!character || !anchor?.text.trim() || !anchor.approvedAt || !Number.isFinite(Date.parse(anchor.approvedAt))) reason = 'The selected identity anchor has no valid approval.';
  else if (!saved && (getIdentityAnchorStatus(character) !== 'approved' || character.identityAnchor?.approvedText !== anchor.text || character.identityAnchor?.approvedAt !== anchor.approvedAt || anchor.approvedMasterIdentityRevision !== getIdentityRevision(character))) reason = 'The selected character snapshot requires anchor refresh and approval.';
  else if (!saved && (!liveMaster || liveMaster.id !== character.sourceId || liveMaster.category !== 'characters' || getIdentityRevision(liveMaster) !== anchor.approvedMasterIdentityRevision || getIdentityAnchorStatus(liveMaster) !== 'approved' || liveMaster.identityAnchor?.approvedText !== anchor.text || liveMaster.identityAnchor?.approvedAt !== anchor.approvedAt)) reason = 'The current character identity anchor is unavailable or stale. Refresh and approve it explicitly.';
  if (reason) return { identity: master, generation: { identitySource: 'master', fallbackReason: reason }, reason };
  return { identity: { source: 'approved_anchor', description: anchor!.text }, generation: structuredClone(choice) };
}
