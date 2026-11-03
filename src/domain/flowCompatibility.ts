export const FLOW_GUIDANCE_DATE='2026-11-04';
export const FLOW_GUIDANCE_SOURCES=['https://support.google.com/flow/answer/16353334','https://support.google.com/flow/answer/16352836'] as const;
export const FLOW_MODELS=[['unverified','Unknown / check in Flow'],['veo-3.1-lite','Veo 3.1 Lite'],['veo-3.1-fast','Veo 3.1 Fast'],['veo-3.1-quality','Veo 3.1 Quality'],['gemini-omni-flash-1.1','Gemini Omni Flash 1.1']] as const;
/** Dated documentation guidance, never account/region entitlement or a provider capability probe. */
export function flowCompatibility(modelKey:string,mode:'frames'|'ingredients',now=new Date()):{status:'Documented'|'Unsupported'|'Unverified';message:string;checkedAt:string;sources:readonly string[]}{
 const known=FLOW_MODELS.some(([id])=>id===modelKey)&&modelKey!=='unverified',age=now.getTime()-Date.parse('2026-11-03T19:10:00Z');
 const status=!known||age<0||age>30*86400000?'Unverified':modelKey==='veo-3.1-quality'&&mode==='ingredients'?'Unsupported':'Documented';
 return{status,checkedAt:FLOW_GUIDANCE_DATE,sources:FLOW_GUIDANCE_SOURCES,message:`${status==='Documented'?'Official guidance lists this mode; account, region and active model support remain unverified.':status==='Unsupported'?'Dated official guidance lists Ingredients as unsupported for this model. Choose another mode/model.':'Model/account/region support is unverified. Check the active Flow controls manually.'} There is no universal ingredient-count limit asserted here. Intermediate-frame timing is not guaranteed; Frames uses a start image and optional end image.`};
}
