import {it,expect} from 'vitest';
import {conversionBlockingPatch,enableBlockingMapping} from '../domain/blockingConversionMapping';
import {makeBlockingFixture} from './fixtures/blockingFixture';
import {applyBlockingPatch,NULL_BLOCKING_DIGEST} from '../domain/blockingPatch';
import {conversionScenario} from './fixtures/recipeConversionFixture';
import {parseChangeSet} from '../domain/changeSetValidation';
it('serializes a complete new plan as a valid typed patch without changing bindings or interactions',()=>{
 const f=makeBlockingFixture(),before=structuredClone(f.draft.blocking),patch=conversionBlockingPatch(f.draft.blocking,NULL_BLOCKING_DIGEST);expect(applyBlockingPatch(undefined,patch,f.draft,NULL_BLOCKING_DIGEST)).toEqual(before);expect(f.draft.blocking).toEqual(before);expect(patch!.participantUpserts!.every(p=>p.bindToRecipe===undefined)).toBe(true);
});
it('explicitly promotes v4 proofs once and never refreshes stale v5 source proof on resume',async()=>{
 const f=await conversionScenario(),original=structuredClone(f.input),next=await enableBlockingMapping(f.input,f.state),op=next.operations[0] as any;expect(f.input).toEqual(original);expect(next.schema).toBe('krakinai.change-set.v5');expect(op.expectedSourceRecipeDigest).toMatch(/^[a-f0-9]{64}$/);expect(()=>parseChangeSet(next)).not.toThrow();const proof=op.expectedSourceRecipeDigest;f.state.scenes[0].reviewNotes='Later foreign source metadata';expect((await enableBlockingMapping(next,f.state)).operations[0]).toMatchObject({expectedSourceRecipeDigest:proof});
});
