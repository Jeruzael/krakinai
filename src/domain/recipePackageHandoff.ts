import type{ChangeSet}from'../types/changeSet';
import{generateId}from'../storage/db';
let pending:ChangeSet|undefined;
/** Transient navigation only: no storage, URL text, authority or surviving approvals. */
export function stageRecipePackage(input:ChangeSet){pending={...structuredClone(input),changeSetId:generateId('recipe_mapping'),source:{kind:'manual',label:'Mapping edited as a new local package'}};}
export function peekRecipePackage(){return pending?structuredClone(pending):undefined;}
export function consumeRecipePackage(id:string){if(pending?.changeSetId===id)pending=undefined;}
