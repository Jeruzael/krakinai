import type { ChangeSetState } from '../types/changeSet';
import type { McpScope, ReceiptGrant } from '../types/mcp';
import { authorizedSceneIds, emptyMcpScope,emptyMcpScopeV2,emptyMcpScopeV3, MCP_SCOPE_LIMITS, validateMcpScope } from './mcpScope';
import { getProjectShots } from './projectStoryboard';

export const PERMISSION_FIELDS = [
  { field: 'projectIds', label: 'Projects' }, { field: 'sceneIds', label: 'Additional scene metadata' },
  { field: 'assetIds', label: 'Reusable assets' }, { field: 'variantIds', label: 'Variants' },
  { field: 'templateIds', label: 'Templates' }, { field: 'mediaIds', label: 'Original media use' },
  { field: 'candidateIds', label: 'Asset candidates' },
  { field: 'fullPromptSceneIds', label: 'Complete scene prompts', sensitive: true },
  { field: 'receiptGrants', label: 'Receipt recovery', sensitive: true },
] as const;
export const DISCLOSURE_FIELDS = [
  { field: 'includeAssetText', label: 'Share ordinary asset prompt text', description: 'Codex can read selected reusable prompt text. Character identity text requires its separate permission.' },
  { field: 'includeCharacterIdentity', label: 'Share Character identities and approved anchors', description: 'Codex can read master identities and approved anchors for selected Characters.' },
  { field: 'includeNotes', label: 'Share private production notes', description: 'Codex can read production, continuity and review notes within the selected context.' },
  { field: 'includeMediaFilenames', label: 'Share media filenames', description: 'Codex can see filenames associated with selected context. Original media bytes are never shared.' },
] as const;
export const CAPABILITY_FIELDS = [
  { field: 'allowProposals', label: 'Allow change-set proposals', description: 'Codex may submit proposals. Every database change still needs your separate browser review.' },
  { field: 'allowNewProjects', label: 'Allow new project creation', description: 'Proposals may request a new project. This does not approve or save the project.' },
] as const;
export type PermissionField = typeof PERMISSION_FIELDS[number]['field']|'blockingSceneIds'|'keyframeSceneIds'|'imagePromptFrameGrants';
export type PermissionFlag = typeof DISCLOSURE_FIELDS[number]['field'] | typeof CAPABILITY_FIELDS[number]['field']|'allowBlockingProposals'|'allowKeyframeProposals'|'allowFrameImageProposals'|'allowImagePromptDerivation';
export interface PermissionRecord { id: string; label: string; category?: string }
export type PermissionInventory = Record<PermissionField, PermissionRecord[]>;
export const receiptKey = (grant: ReceiptGrant) => grant.changeSetId + ':' + grant.packageDigest;
export const permissionIds = (scope: McpScope, field: PermissionField): string[] =>field==='imagePromptFrameGrants'?scope.version===3?scope.imagePromptFrameGrants.map(g=>JSON.stringify([g.sceneId,g.frameId])):[]:field==='keyframeSceneIds'?scope.version===3?scope.keyframeSceneIds:[]:field==='blockingSceneIds'?scope.version!==1?scope.blockingSceneIds:[]: field === 'receiptGrants' ? scope.receiptGrants.map(receiptKey) : scope[field];

export function buildPermissionInventory(state: ChangeSetState, scope:McpScope = emptyMcpScope()): PermissionInventory {
  const authorized = authorizedSceneIds(scope, state);
  return {
    projectIds: state.collections.map(p => ({ id: p.id, label: p.name })),
    sceneIds: state.scenes.map(s => ({ id: s.id, label: s.title })),
    assetIds: state.assets.map(a => ({ id: a.id, label: a.title, category: a.category })),
    variantIds: (state.variants ?? []).map(v => ({ id: v.id, label: v.title, category: v.type })),
    templateIds: state.templates.map(t => ({ id: t.id, label: t.name, category: t.category })),
    mediaIds: state.media.map(m => ({ id: m.id, label: m.displayName ?? m.filename })),
    candidateIds: [...(state.preferences.aiImports?.candidates ?? []).filter(c => c.status === 'pending' || scope.candidateIds.includes(c.id)).map(c => ({ id: c.id, label: c.title, category: c.kind })),...(state.preferences.aiImports?.variantCandidates??[]).filter(c=>c.status==='pending'||scope.candidateIds.includes(c.id)).map(c=>({id:c.id,label:c.title,category:'Outfit'}))],
    fullPromptSceneIds: state.scenes.filter(s => authorized.has(s.id)).map(s => ({ id: s.id, label: s.title })),
    receiptGrants: (state.preferences.aiImports?.receipts ?? []).map(r => ({ id: receiptKey(r), label: r.title ?? r.changeSetId })),
    keyframeSceneIds:state.scenes.filter(s=>authorized.has(s.id)).map(s=>({id:s.id,label:s.title})),
    imagePromptFrameGrants:state.scenes.filter(s=>authorized.has(s.id)&&scope.version===3&&scope.keyframeSceneIds.includes(s.id)).flatMap(s=>(s.keyframePlan?.frames??[]).map(f=>({id:JSON.stringify([s.id,f.id]),label:s.title+' / '+f.label}))),
    blockingSceneIds:state.scenes.filter(s=>authorized.has(s.id)).map(s=>({id:s.id,label:s.title})),
  };
}
function checked(scope: McpScope): McpScope {
  for (const { field, label } of PERMISSION_FIELDS) {
    const count = permissionIds(scope, field).length, limit = MCP_SCOPE_LIMITS[field];
    if (count > limit) throw Error(label + ': ' + count + ' selected exceeds the limit of ' + limit + '. Narrow the category or search; nothing was partially selected.');
  }
  const reusable = scope.assetIds.length + scope.variantIds.length + scope.templateIds.length;
  if (reusable > MCP_SCOPE_LIMITS.reusableRecords) throw Error(reusable + ' reusable records exceed the combined limit of ' + MCP_SCOPE_LIMITS.reusableRecords + ' assets, variants and templates. Narrow the selection; nothing was partially selected.');
  return validateMcpScope(scope);
}
function withIds(scope: McpScope, field: PermissionField, ids: string[]): McpScope {
  const copy = structuredClone(scope);
  if (field === 'receiptGrants') copy.receiptGrants = ids.map(key => ({ changeSetId: key.slice(0, -65), packageDigest: key.slice(-64) }));
  else if(field==='blockingSceneIds'){if(copy.version===1)throw Error('Enable the Blocking permission format and make a fresh pairing first.');copy.blockingSceneIds=ids;}
  else if(field==='keyframeSceneIds'){if(copy.version!==3)throw Error('Enable frame permissions and make a fresh pairing first.');copy.keyframeSceneIds=ids;}
  else if(field==='imagePromptFrameGrants'){if(copy.version!==3)throw Error('Enable frame permissions first.');copy.imagePromptFrameGrants=ids.map(id=>{const pair=JSON.parse(id);if(!Array.isArray(pair)||pair.length!==2)throw Error('Invalid exact frame selection.');return{sceneId:pair[0],frameId:pair[1]};});}
  else copy[field] = ids;
  return copy;
}
export function changeSelection(scope: McpScope, field: PermissionField, ids: string[], selected: boolean): McpScope {
  const values = new Set(permissionIds(scope, field));
  for (const id of ids) { if (selected) values.add(id); else values.delete(id); }
  return checked(withIds(scope, field, [...values]));
}
export function normalizePermissionDraft(scope: McpScope, state: ChangeSetState): McpScope {
  const authorized = authorizedSceneIds(scope, state);
  return { ...structuredClone(scope), fullPromptSceneIds: scope.fullPromptSceneIds.filter(id => authorized.has(id)),...(scope.version!==1?{blockingSceneIds:scope.blockingSceneIds.filter(id=>authorized.has(id)&&state.scenes.some(s=>s.id===id))}:{}),...(scope.version===3?{keyframeSceneIds:scope.keyframeSceneIds.filter(id=>authorized.has(id)),imagePromptFrameGrants:scope.imagePromptFrameGrants.filter(g=>authorized.has(g.sceneId)&&scope.keyframeSceneIds.includes(g.sceneId)&&state.scenes.find(s=>s.id===g.sceneId)?.keyframePlan?.frames.some(f=>f.id===g.frameId))}:{}) };
}
export function validatePermissionDraft(scope: McpScope, state: ChangeSetState): McpScope {
  const checkedScope = checked(scope), inventory = buildPermissionInventory(state, checkedScope);
  for (const { field, label } of PERMISSION_FIELDS) {
    const known = new Set(inventory[field].map(r => r.id));
    if (permissionIds(checkedScope, field).some(id => !known.has(id))) throw Error(label + ': a selected record is unavailable or no longer authorized. Remove it or refresh your selection before applying.');
  }
  if(checkedScope.version!==1&&checkedScope.blockingSceneIds.some(id=>!inventory.blockingSceneIds.some(r=>r.id===id)))throw Error('Blocking authoring text: a selected scene is unavailable or outside the selected metadata scope.');
  if(checkedScope.version===3)for(const field of ['keyframeSceneIds','imagePromptFrameGrants'] as const)if(permissionIds(checkedScope,field).some(id=>!inventory[field].some(r=>r.id===id)))throw Error('An exact frame permission is unavailable or outside the selected plan and metadata scope.');
  return checkedScope;
}
export function selectAllRecords(scope: McpScope, state: ChangeSetState): McpScope {
  let next = structuredClone(scope);
  const inventory = buildPermissionInventory(state, next);
  for (const { field } of PERMISSION_FIELDS) if (field !== 'fullPromptSceneIds' && field !== 'receiptGrants') next = withIds(next, field, inventory[field].map(r => r.id));
  return checked(next);
}
export function clearAllRecords(scope: McpScope): McpScope {
  let next = structuredClone(scope);
  for (const { field } of PERMISSION_FIELDS) next = withIds(next, field, []);
  if(next.version!==1)next.blockingSceneIds=[];
  if(next.version===3){next.keyframeSceneIds=[];next.imagePromptFrameGrants=[];}
  return next;
}
export function presetPermissionDraft(
  preset: 'minimal' | 'creative' | 'full',
  scope: McpScope,
  state: ChangeSetState,
  options?: { connected?: boolean; grantAll?: boolean },
): McpScope {
  const targetVersion: 1 | 2 | 3 = preset === 'full' && options?.grantAll && !options?.connected ? 3 : scope.version;
  let next: McpScope = {
    ...(targetVersion === 3 ? emptyMcpScopeV3() : targetVersion === 2 ? emptyMcpScopeV2() : emptyMcpScope()),
    epoch: scope.epoch,
    projectIds: [...scope.projectIds],
  };
  if (preset === 'creative') {
    next = {
      ...next,
      assetIds: [...scope.assetIds],
      variantIds: [...scope.variantIds],
      templateIds: [...scope.templateIds],
      allowProposals: true,
    };
  }
  if (preset === 'full') {
    next = selectAllRecords(next, state);
    next.fullPromptSceneIds = state.scenes.map(s => s.id).slice(0, MCP_SCOPE_LIMITS.fullPromptSceneIds);
    next.receiptGrants = (state.preferences.aiImports?.receipts ?? [])
      .slice(0, MCP_SCOPE_LIMITS.receiptGrants)
      .map(r => ({ changeSetId: r.changeSetId, packageDigest: r.packageDigest }));
    for (const { field } of [...DISCLOSURE_FIELDS, ...CAPABILITY_FIELDS]) next[field] = true;
    if (options?.grantAll) {
      if (next.version !== 1) {
        next.blockingSceneIds = state.scenes.map(s => s.id).slice(0, MCP_SCOPE_LIMITS.blockingSceneIds);
        next.allowBlockingProposals = true;
      }
      if (next.version === 3) {
        next.keyframeSceneIds = state.scenes.map(s => s.id).slice(0, MCP_SCOPE_LIMITS.keyframeSceneIds);
        next.imagePromptFrameGrants = state.scenes
          .flatMap(s => (s.keyframePlan?.frames ?? []).map(f => ({ sceneId: s.id, frameId: f.id })))
          .slice(0, MCP_SCOPE_LIMITS.imagePromptFrameGrants);
        next.allowKeyframeProposals = true;
        next.allowFrameImageProposals = true;
        next.allowImagePromptDerivation = true;
      }
    }
  }
  return checked(next);
}
export interface PermissionDifference {
  field: PermissionField | PermissionFlag; label: string; kind: 'read' | 'sensitive' | 'capability';
  before: number | boolean; after: number | boolean; added: PermissionRecord[]; removed: PermissionRecord[];
}
export function scopeDiff(before: McpScope, after: McpScope, inventory: PermissionInventory): PermissionDifference[] {
  const rows: PermissionDifference[] = PERMISSION_FIELDS.map(item => {
    const field = item.field, oldIds = permissionIds(before, field), newIds = permissionIds(after, field);
    const label = (id: string) => ({ id, label: inventory[field].find(r => r.id === id)?.label ?? id });
    return { field, label: item.label, kind: field === 'fullPromptSceneIds' || field === 'receiptGrants' ? 'sensitive' : 'read', before: oldIds.length, after: newIds.length, added: newIds.filter(id => !oldIds.includes(id)).map(label), removed: oldIds.filter(id => !newIds.includes(id)).map(label) };
  });
  for (const item of [...DISCLOSURE_FIELDS, ...CAPABILITY_FIELDS]) rows.push({ field: item.field, label: item.label, kind: item.field.startsWith('allow') ? 'capability' : 'sensitive', before: before[item.field], after: after[item.field], added: [], removed: [] });
  if(before.version!==1||after.version!==1){
    const oldIds=permissionIds(before,'blockingSceneIds'),newIds=permissionIds(after,'blockingSceneIds'),label=(id:string)=>({id,label:inventory.blockingSceneIds.find(r=>r.id===id)?.label??id});
    rows.push({field:'blockingSceneIds',label:'Blocking authoring text',kind:'sensitive',before:oldIds.length,after:newIds.length,added:newIds.filter(id=>!oldIds.includes(id)).map(label),removed:oldIds.filter(id=>!newIds.includes(id)).map(label)});
    rows.push({field:'allowBlockingProposals',label:'Allow blocking proposals',kind:'capability',before:before.version!==1&&before.allowBlockingProposals,after:after.version!==1&&after.allowBlockingProposals,added:[],removed:[]});
  }
  if(before.version===3||after.version===3){
    for(const field of ['keyframeSceneIds','imagePromptFrameGrants'] as const){const a=permissionIds(before,field),b=permissionIds(after,field),label=(id:string)=>({id,label:inventory[field].find(r=>r.id===id)?.label??id});rows.push({field,label:field==='keyframeSceneIds'?'Frame plan text':'Complete saved image prompts',kind:'sensitive',before:a.length,after:b.length,added:b.filter(id=>!a.includes(id)).map(label),removed:a.filter(id=>!b.includes(id)).map(label)});}
    for(const field of ['allowKeyframeProposals','allowFrameImageProposals','allowImagePromptDerivation'] as const)rows.push({field,label:field,kind:'capability',before:before.version===3&&before[field],after:after.version===3&&after[field],added:[],removed:[]});
  }
  return rows;
}
export function permissionFingerprint(scope: McpScope): string {
  return JSON.stringify([PERMISSION_FIELDS.map(({ field }) => [...permissionIds(scope, field)].sort()), [...DISCLOSURE_FIELDS, ...CAPABILITY_FIELDS].map(({ field }) => scope[field]),...(scope.version!==1?[{version:scope.version,blockingSceneIds:[...scope.blockingSceneIds].sort(),allowBlockingProposals:scope.allowBlockingProposals}]:[]),...(scope.version===3?[{keyframeSceneIds:[...scope.keyframeSceneIds].sort(),imagePromptFrameGrants:[...permissionIds(scope,'imagePromptFrameGrants')].sort(),allowKeyframeProposals:scope.allowKeyframeProposals,allowFrameImageProposals:scope.allowFrameImageProposals,allowImagePromptDerivation:scope.allowImagePromptDerivation}]:[])]);
}
export function permissionInventoryStamp(state: ChangeSetState): string {
  return JSON.stringify([state.collections.map(p => [p.id, p.project?.revision]), state.scenes.map(s => [s.id, s.revision]), state.assets.map(a => [a.id, a.revision]), (state.variants ?? []).map(v => [v.id, v.revision]), state.templates.map(t => [t.id, t.revision]), state.media.map(m => m.id), (state.preferences.aiImports?.candidates ?? []).map(c => [c.id, c.status]), ...((state.preferences.aiImports?.variantCandidates?.length??0)?[(state.preferences.aiImports!.variantCandidates!).map(c=>[c.id,c.status,c.revision])]:[]), (state.preferences.aiImports?.receipts ?? []).map(receiptKey)]);
}
export function projectPermissionContext(projectId: string, state: ChangeSetState) {
  const project = state.collections.find(p => p.id === projectId);
  if (!project) throw Error('The selected project is no longer available.');
  const shots = getProjectShots(project, state.scenes), sceneIds = [...new Set(shots.flatMap(s => s.takeSceneIds))];
  const scenes = state.scenes.filter(s => sceneIds.includes(s.id)), assets = new Set<string>(), variants = new Set<string>(), media = new Set<string>();
  for (const member of project.members) { if (member.type === 'asset') assets.add(member.id); if (member.type === 'variant') variants.add(member.id); }
  for (const cast of project.project?.cast ?? []) { assets.add(cast.characterId); for (const id of cast.referenceMediaIds ?? []) media.add(id); for (const id of cast.approvedWardrobeVariantIds ?? []) variants.add(id); }
  for (const scene of scenes) {
    for (const slot of Object.values(scene.slots)) if (slot) { if (slot.sourceType === 'asset') assets.add(slot.sourceId); if (slot.sourceType === 'variant') variants.add(slot.sourceId); }
    for (const link of [...scene.references, ...(scene.sourceMediaLinks ?? []), ...(scene.referencePack?.entries ?? [])]) media.add(link.mediaId);
  }
  const linkedVariants = (state.variants ?? []).filter(variant => variants.has(variant.id));
  for (const variant of linkedVariants) if (variant.parentCharacterId) assets.add(variant.parentCharacterId);
  for (const record of [...state.assets.filter(asset => assets.has(asset.id)), ...linkedVariants]) {
    for (const link of record.mediaLinks) media.add(link.mediaId);
    if (record.coverMediaId) media.add(record.coverMediaId);
  }
  for (const shot of shots) { if (shot.firstFrameMediaId) media.add(shot.firstFrameMediaId); if (shot.lastFrameMediaId) media.add(shot.lastFrameMediaId); }
  const knownMedia = new Set(state.media.map(m => m.id));
  return { project, shotCount: shots.length, sceneCount: scenes.length, missingSceneIds: sceneIds.filter(id => !scenes.some(s => s.id === id)), relatedAssetIds: [...assets].filter(id => state.assets.some(a => a.id === id)), relatedVariantIds: [...variants].filter(id => (state.variants ?? []).some(v => v.id === id)), missingMediaIds: [...media].filter(id => !knownMedia.has(id)), pendingInputs: scenes.reduce((count, s) => count + (s.pendingInputs?.length ?? 0), 0) };
}

/** A format switch is preparation for a fresh pairing, never a permission preset. */
export function permissionScopeFormat(scope:McpScope,version:1|2|3):McpScope{
 const common=Object.fromEntries(Object.keys(emptyMcpScope()).filter(k=>k!=='version').map(k=>[k,structuredClone(scope[k as keyof McpScope])]));
 if(version===1)return validateMcpScope({...emptyMcpScope(),...common,version:1} as McpScope);
 const blocking=scope.version!==1?{blockingSceneIds:[...scope.blockingSceneIds],allowBlockingProposals:scope.allowBlockingProposals}:{};
 return validateMcpScope({...version===3?emptyMcpScopeV3():emptyMcpScopeV2(),...common,...blocking,version} as McpScope);
}
