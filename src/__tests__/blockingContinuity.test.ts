import {it,expect} from 'vitest';
import {makeBlockingFixture} from './fixtures/blockingFixture';
import {compareBlockingPair} from '../domain/blockingContinuity';
import {buildContinuityWorkspace} from '../domain/continuityWorkspace';
import {blockingBindingToken} from '../domain/blockingValidation';
import type {SavedScene} from '../types/domain';
function pair(){
 const {draft,state}=makeBlockingFixture(),parent=state.scenes.find(s=>s.id==='ensemble-parent')!;
 const previous={...structuredClone(parent),id:'previous',blocking:structuredClone(draft.blocking)} as SavedScene,current={...structuredClone(parent),id:'current',blocking:structuredClone(draft.blocking)} as SavedScene;
 current.blocking!.participants.forEach((p,i)=>p.start=structuredClone(previous.blocking!.participants[i].end));
 current.blocking!.props.forEach((p,i)=>p.startHolder=structuredClone(previous.blocking!.props[i].endHolder));
 return{previous,current};
}
it('compares exact IDs without changing records or claiming absent blocking is unsafe',()=>{
 const {previous,current}=pair(),before=structuredClone([previous,current]);const result=compareBlockingPair(previous,current);
 expect(result.previousSceneId).toBe('previous');expect(result.currentSceneId).toBe('current');expect(result.comparable).toBe(true);expect(result.findings).toEqual([]);expect([previous,current]).toEqual(before);
 current.blocking=undefined;const missing=compareBlockingPair(previous,current);expect(missing.comparable).toBe(false);expect(missing.basis.reason).toBe('missing_blocking');expect(missing.findings).toEqual([]);
});
it.each([
 ['zone','left','B_POSITION'],['depth','foreground','B_POSITION'],
 ['bodyDirection',{kind:'target',target:{kind:'landmark',landmarkId:'door'}},'B_FACING'],
 ['headDirection',{kind:'target',target:{kind:'camera'}},'B_HEAD'],['eyeline',{kind:'camera'},'B_EYELINE'],
] as const)('reports authored %s differences as advisory with exact evidence', (field,value,code)=>{
 const {previous,current}=pair();Object.assign(current.blocking!.participants[0].start!,{[field]:value});const result=compareBlockingPair(previous,current),finding=result.findings.find(f=>f.code===code)!;
 expect(finding).toBeDefined();expect(finding.severity).toBe('advisory');expect(finding.previousSceneId).toBe(previous.id);expect(finding.currentSceneId).toBe(current.id);expect(finding.participant).toEqual({kind:'ensemble',participantId:'primary'});expect(finding.path).toContain(field);expect(finding.before).not.toEqual(finding.after);
 expect(result.findings.every(f=>f.severity==='advisory')).toBe(true);
});
it('compares a real prop in the same declared space and accepts an explicit transfer or shared holding',()=>{
 const {previous,current}=pair(),aya={kind:'ensemble' as const,participantId:'primary'},lucas={kind:'ensemble' as const,participantId:'lucas'};
 current.blocking!.props[0].startHolder={kind:'participant',participant:lucas};
 expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_PROP_HOLDER'&&f.propId==='bouquet')).toBe(true);
 current.blocking!.participants[0].action!.interactions=[{id:'handoff',kind:'transfer_prop',propId:'bouquet',from:aya,to:lucas}];
 expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_PROP_HOLDER')).toBe(false);
 current.blocking!.participants[0].action!.interactions=[];previous.blocking!.props[0].endHolder={kind:'shared',participants:[aya,lucas]};
 expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_PROP_HOLDER')).toBe(false);
});
it('treats visibility changes as editorial review and honors an authored exit',()=>{
 const {previous,current}=pair();previous.blocking!.participants[0].end!.visibility='out_of_frame';
 expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_VISIBILITY')).toBe(true);
 previous.blocking!.participants[0].action!.kind='exit';expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_VISIBILITY')).toBe(false);
});
it('reports a same-basis camera side change but does not geometrically invert reversed axis definitions',()=>{
 const {previous,current}=pair();current.blocking!.camera!.axis!.side='B';expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_CAMERA_AXIS')).toBe(true);
 const axis=current.blocking!.camera!.axis!;[axis.from,axis.to]=[axis.to,axis.from];const result=compareBlockingPair(previous,current);
 expect(result.basis.reason).toBe('axis_mismatch');expect(result.findings.some(f=>f.code==='B_CAMERA_AXIS')).toBe(false);
});
it('does not equate identically named landmarks across unrelated declared spaces',()=>{
 const {previous,current}=pair();current.blocking!.space!.id='other-chapel';current.blocking!.props[0].startHolder={kind:'participant',participant:{kind:'ensemble',participantId:'lucas'}};
 current.blocking!.participants[0].start!.eyeline={kind:'landmark',landmarkId:'altar'};
 const result=compareBlockingPair(previous,current);expect(result.basis.reason).toBe('space_mismatch');expect(result.findings.some(f=>['B_PROP_HOLDER','B_EYELINE','B_CAMERA_AXIS'].includes(f.code))).toBe(false);
});
it('does not match an ambiguous repeated Character or infer a match from its title',()=>{
 const {previous,current}=pair(),actor=current.ensemble!.participants[0];current.ensemble!.participants.push({...structuredClone(actor),id:'duplicate'});
 current.blocking!.participants[0].start!.zone='left';let result=compareBlockingPair(previous,current);
 expect(result.basis.reason).toBe('ambiguous_participants');expect(result.findings.some(f=>f.participant?.kind==='ensemble'&&f.participant.participantId==='primary')).toBe(false);
 current.ensemble!.participants.pop();actor.character.sourceId='different-identity';current.blocking!.participants[0].bindingToken=blockingBindingToken(actor.character);
 result=compareBlockingPair(previous,current);expect(result.basis.participantPairs.some(p=>p.current.kind==='ensemble'&&p.current.participantId==='primary')).toBe(false);
});
it('requires explicit same-ID comparison mapping for a repeated Character and never maps a different identity',()=>{
 const {previous,current}=pair(),actor=current.ensemble!.participants[0];current.ensemble!.participants.push({...structuredClone(actor),id:'duplicate'});current.blocking!.participants[0].start!.zone='left';
 const participant={kind:'ensemble' as const,participantId:'primary'},options={participantPairs:[{previous:participant,current:participant}]};
 expect(compareBlockingPair(previous,current,options).findings.some(f=>f.code==='B_POSITION')).toBe(true);
 actor.character.sourceId='different-identity';current.blocking!.participants[0].bindingToken=blockingBindingToken(actor.character);
 expect(compareBlockingPair(previous,current,options).basis.participantPairs.some(p=>p.current.kind==='ensemble'&&p.current.participantId==='primary')).toBe(false);
});
it('compares declared props without manufacturing performers in a Character-free scene',()=>{
 const {previous,current}=pair();for(const scene of[previous,current]){scene.ensemble=undefined;delete scene.slots.character;delete scene.slots.wardrobe;scene.shotType='property_environment';scene.blocking!.participants=[];scene.blocking!.camera=undefined;scene.blocking!.props[0].startHolder={kind:'landmark',landmarkId:'door'};scene.blocking!.props[0].endHolder={kind:'landmark',landmarkId:'door'};}
 current.blocking!.props[0].startHolder={kind:'landmark',landmarkId:'altar'};const result=compareBlockingPair(previous,current);
 expect(result.comparable).toBe(true);expect(result.basis.participantPairs).toEqual([]);expect(result.findings.some(f=>f.code==='B_PROP_HOLDER')).toBe(true);
});
it('compares a legacy primary only when bound to the same actual stored Character',()=>{
 const {previous,current}=pair();for(const scene of [previous,current]){scene.ensemble=undefined;scene.blocking!.participants=[{...scene.blocking!.participants[0],participant:{kind:'primary'}}];scene.blocking!.props=[];scene.blocking!.camera=undefined;}
 current.blocking!.participants[0].start!.zone='left';expect(compareBlockingPair(previous,current).findings.some(f=>f.code==='B_POSITION')).toBe(true);
 current.slots.character!.sourceType='template';current.blocking!.participants[0].bindingToken=blockingBindingToken(current.slots.character!);
 const result=compareBlockingPair(previous,current);expect(result.basis.reason).toBe('unbound');expect(result.findings).toEqual([]);
});
it('does not make off-camera targets visible or treat an unknown optional field as a contradiction',()=>{
 const {previous,current}=pair();current.blocking!.participants[0].start!.eyeline={kind:'participant',participant:{kind:'ensemble',participantId:'marco'}};
 const result=compareBlockingPair(previous,current);expect(result.findings.some(f=>f.code==='B_EYELINE')).toBe(true);expect(result.basis.participantPairs.some(p=>p.current.kind==='ensemble'&&p.current.participantId==='marco')).toBe(false);
 current.blocking!.participants[0].start={};expect(compareBlockingPair(previous,current).findings.filter(f=>f.participant?.kind==='ensemble'&&f.participant.participantId==='primary')).toEqual([]);
});
it('discloses invalid saved blocking as uncomparable rather than throwing or inventing a valid comparison',()=>{
 const {previous,current}=pair();current.blocking!.participants[0].bindingToken='stale';const result=compareBlockingPair(previous,current);
 expect(result.comparable).toBe(false);expect(result.basis.reason).toBe('invalid_blocking');expect(result.findings.every(f=>f.severity==='advisory')).toBe(true);
});
it('derives availability for the workspace without reassembling or changing saved outputs',()=>{
 const {draft,state,parentSceneId}=makeBlockingFixture(),parent=state.scenes.find(s=>s.id===parentSceneId)!;parent.blocking=structuredClone(draft.blocking);const before=structuredClone(state.scenes);
 const model=buildContinuityWorkspace(state.collections[0],state.scenes,state.media);
 expect(model.rows.find(row=>row.scene?.id===parentSceneId)?.blockingAvailable).toBe(true);expect(model.rows[0].blockingAvailable).toBe(false);expect(state.scenes).toEqual(before);
});
