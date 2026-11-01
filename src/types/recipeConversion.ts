import type {BuilderSlot} from './domain';
export type ConversionMappingTarget =
 | {kind:'slot';slot:BuilderSlot}
 | {kind:'participant';participantId:string;field:'character'|'wardrobe'}
 | {kind:'cue';cueId:string}
 | {kind:'settings'|'instructions'|'avoid'|'references'|'source_media'|'pending_inputs'};
export interface ConversionMappingRow {
 id:string;
 target:ConversionMappingTarget;
 assessment:'suggested'|'uncertain'|'unassigned'|'omitted';
 explanation?:string;
 sourceSpan?:{start:number;end:number};
}
export interface ConversionInput {version:1;sourceTextSha256:string;mappings:ConversionMappingRow[]}
export interface ConversionProvenance extends ConversionInput {sourceSceneId:string}
export interface ConversionDecision {reviewed:boolean;acknowledgedRowIds:string[]}
