/** Lossless local $defs keep discovery bounded as supported contracts accumulate.
 * Request validation still uses the unchanged strict native schemas. */
export function factorDiscoverySchema<T>(schema:T):T{
 const counts=new Map<string,number>(),definitions:Record<string,unknown>={},names=new Map<string,string>();
 const candidate=(v:Record<string,unknown>)=>'type'in v||'oneOf'in v||'anyOf'in v||'allOf'in v;
 // A nested $id establishes its own reference base. Factor each such resource
 // independently so #/$defs never resolves against a different contract.
 const resource=(value:unknown)=>value!==schema&&!!value&&typeof value==='object'&&!Array.isArray(value)&&typeof (value as Record<string,unknown>).$id==='string';
 const count=(value:unknown):void=>{if(Array.isArray(value)){value.forEach(count);return;}if(!value||typeof value!=='object'||resource(value))return;const obj=value as Record<string,unknown>;if(candidate(obj)){const key=JSON.stringify(obj);if(key.length>=80)counts.set(key,(counts.get(key)??0)+1);}Object.values(obj).forEach(count);};
 count(schema);
 const children=(obj:Record<string,unknown>)=>Object.fromEntries(Object.entries(obj).map(([key,value])=>[key,visit(value)]));
 const visit=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(visit);if(!value||typeof value!=='object')return value;
  if(resource(value))return factorDiscoverySchema(value);
  const obj=value as Record<string,unknown>,key=JSON.stringify(obj);
  if(candidate(obj)&&(counts.get(key)??0)>1){let name=names.get(key);if(!name){name='s'+names.size;names.set(key,name);definitions[name]=children(obj);}return{$ref:'#/$defs/'+name};}
  return children(obj);
 };
 const root=children(schema as Record<string,unknown>);return{...root,...(names.size?{$defs:definitions}:{})} as T;
}
