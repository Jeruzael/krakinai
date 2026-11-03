import type {ReactNode} from 'react';
import type {BlockingSource,SceneBlockingV1,TargetRef,InteractionTargetRef,BlockingDirection,BlockingHolder} from '../../types/blocking';
import {blockingParticipantKey,blockingParticipantSources} from '../../domain/blockingValidation';
export const human=(text:string)=>text.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="blocking-field"><span>{label}</span>{children}</label>;}
export function Choice({label,value,options,onChange,disabledOptions=[]}:{label:string;value:string|undefined;options:readonly string[];onChange:(value:string|undefined)=>void;disabledOptions?:string[]}){return <Field label={label}><select className="select" value={value??''} onChange={e=>onChange(e.target.value||undefined)}><option value="">Unspecified</option>{value&&!options.includes(value)&&<option value={value}>Unresolved saved value: {value}</option>}{options.map(option=><option key={option} value={option} disabled={disabledOptions.includes(option)}>{human(option)}</option>)}</select></Field>;}
export interface JsonOption<T>{value:T;label:string}
export function JsonChoice<T>({label,value,options,onChange}:{label:string;value:T|undefined;options:JsonOption<T>[];onChange:(value:T|undefined)=>void}){
 const key=value===undefined?'':JSON.stringify(value),available=options.some(option=>JSON.stringify(option.value)===key);
 return <Field label={label}><select className="select" value={key} onChange={e=>onChange(e.target.value?JSON.parse(e.target.value) as T:undefined)}><option value="">Unspecified</option>{key&&!available&&<option value={key}>Unresolved saved value (preserved)</option>}{options.map(option=><option key={JSON.stringify(option.value)} value={JSON.stringify(option.value)}>{option.label}</option>)}</select></Field>;
}
export function targetOptions(source:BlockingSource,blocking:SceneBlockingV1,props=false):JsonOption<InteractionTargetRef>[] {
 return [...blockingParticipantSources(source).map(p=>({value:{kind:'participant',participant:p.ref} as TargetRef,label:`${p.character.sourceTitle} · ${blockingParticipantKey(p.ref)}${p.presence==='off_camera'?' (off camera)':''}`})),...blocking.landmarks.map(l=>({value:{kind:'landmark',landmarkId:l.id} as TargetRef,label:`${l.label} · landmark:${l.id}`})),{value:{kind:'camera'},label:'Camera'},...(props?blocking.props.map(p=>({value:{kind:'prop',propId:p.id} as InteractionTargetRef,label:`${p.label} · prop:${p.id}`})):[])];
}
export function DirectionField({label,value,onChange,source,blocking}:{label:string;value?:BlockingDirection;onChange:(value:BlockingDirection|undefined)=>void;source:BlockingSource;blocking:SceneBlockingV1}){
 const screen=['toward_camera','away_from_camera','screen_left','screen_right','toward_left','toward_right','away_left','away_right'] as const;
 const options:JsonOption<BlockingDirection>[]=[...screen.map(direction=>({value:{kind:'screen' as const,direction},label:human(direction)})),...targetOptions(source,blocking).map(option=>({value:{kind:'target' as const,target:option.value as TargetRef},label:'Toward '+option.label}))];
 return <JsonChoice label={label} value={value} onChange={onChange} options={options}/>;
}
export function HolderField({label,value,onChange,source,blocking}:{label:string;value?:BlockingHolder;onChange:(value:BlockingHolder|undefined)=>void;source:BlockingSource;blocking:SceneBlockingV1}){
 const people=blockingParticipantSources(source),shared:BlockingHolder={kind:'shared',participants:[]};
 const options:JsonOption<BlockingHolder>[]=[{value:{kind:'unheld'},label:'Unheld'},...people.map(p=>({value:{kind:'participant' as const,participant:p.ref},label:`${p.character.sourceTitle} · ${blockingParticipantKey(p.ref)}`})),...blocking.landmarks.map(l=>({value:{kind:'landmark' as const,landmarkId:l.id},label:l.label})),{value:shared,label:'Shared holders'}];
 return <div><JsonChoice label={label} value={value?.kind==='shared'?shared:value} options={options} onChange={onChange}/>{value?.kind==='shared'&&<fieldset><legend>{label}: select at least two people</legend>{people.map(p=>{const key=blockingParticipantKey(p.ref),checked=value.participants.some(ref=>blockingParticipantKey(ref)===key);return <label key={key} className="blocking-check"><input type="checkbox" checked={checked} onChange={e=>onChange({kind:'shared',participants:e.target.checked?[...value.participants,p.ref]:value.participants.filter(ref=>blockingParticipantKey(ref)!==key)})}/>{p.character.sourceTitle} · {key}</label>;})}</fieldset>}</div>;
}
