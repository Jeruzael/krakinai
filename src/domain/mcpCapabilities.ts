import {McpError} from './mcpProtocol';
import {canonicalStringify} from './changeSetCanonical';
export const BLOCKING_BRIDGE_VERSION='krakinai.bridge.v2' as const;
export const MCP_BLOCKING_CAPABILITIES=Object.freeze(['blocking.v1','change-set.v5','scope.v2'] as const);
export function validateMcpCapabilities(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>16||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||!/^[a-z][a-z0-9.-]{0,63}$/.test(v)))throw new McpError('AUTH_FAILED','Invalid authenticated peer capabilities.');
 return [...value];
}
export function intersectMcpCapabilities(client:unknown,server:unknown):string[]{const a=validateMcpCapabilities(client),b=validateMcpCapabilities(server);return a.filter(c=>b.includes(c)).sort();}
export function validateCapabilityTranscript(transcript:Record<string,unknown>,offered:readonly string[]):string[]{
 const client=validateMcpCapabilities(transcript.clientCapabilities),server=validateMcpCapabilities(transcript.serverCapabilities),selected=validateMcpCapabilities(transcript.capabilities);
 if(canonicalStringify(client)!==canonicalStringify(offered)||canonicalStringify(selected)!==canonicalStringify(intersectMcpCapabilities(client,server)))throw new McpError('AUTH_FAILED','Peer capabilities changed during pairing.');
 return selected;
}
export function requireBlockingCapabilities(capabilities:readonly string[]):void{
 if(!MCP_BLOCKING_CAPABILITIES.every(c=>capabilities.includes(c)))throw new McpError('CAPABILITY_REQUIRED','Update the local bridge and make a fresh native pairing to use Blocking permissions and v5 proposals.');
}

export const MCP_KEYFRAME_CAPABILITIES=Object.freeze([...MCP_BLOCKING_CAPABILITIES,'keyframes.v1','image-prompts.v1','change-set.v6','scope.v3'] as const);
export function requireKeyframeCapabilities(capabilities:readonly string[]):void{
 if(!MCP_KEYFRAME_CAPABILITIES.every(c=>capabilities.includes(c)))throw new McpError('CAPABILITY_REQUIRED','Update the local bridge and Disconnect, then make a fresh native pairing to use frame plans, image prompts and v6 proposals.');
}
