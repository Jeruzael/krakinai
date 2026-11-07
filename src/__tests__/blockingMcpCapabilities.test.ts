import {it,expect} from 'vitest';
import {MCP_BLOCKING_CAPABILITIES,intersectMcpCapabilities,validateCapabilityTranscript,requireBlockingCapabilities} from '../domain/mcpCapabilities';
import {emptyMcpScope,emptyMcpScopeV2,validateMcpScope} from '../domain/mcpScope';
import {MCP_TOOL_NAMES,MCP_LIMITS} from '../domain/mcpProtocol';
import {ProposalBroker} from '../connections/proposalBroker';
it('preserves exact v1 scope and creates independently disabled v2 grants',()=>{
 const old=emptyMcpScope();expect(old.version).toBe(1);expect(()=>validateMcpScope({...old,blockingSceneIds:[]} as any)).toThrow();
 const scope=emptyMcpScopeV2();expect(scope.version).toBe(2);expect(scope.blockingSceneIds).toEqual([]);expect(scope.allowBlockingProposals).toBe(false);expect(()=>validateMcpScope(scope)).not.toThrow();
 expect(old).not.toHaveProperty('blockingSceneIds');scope.blockingSceneIds.push('scene-one');expect(emptyMcpScopeV2().blockingSceneIds).toEqual([]);
 expect(()=>validateMcpScope({...scope,blockingSceneIds:Array.from({length:251},(_,i)=>'s'+i)})).toThrow();
});
it('uses a bounded exact authenticated capability intersection without extra tools or larger limits',()=>{
 expect(intersectMcpCapabilities([...MCP_BLOCKING_CAPABILITIES,'future.example'],MCP_BLOCKING_CAPABILITIES)).toEqual(MCP_BLOCKING_CAPABILITIES);
 expect(intersectMcpCapabilities(MCP_BLOCKING_CAPABILITIES,[])).toEqual([]);expect(()=>requireBlockingCapabilities([])).toThrow(/update|support/i);
 expect(MCP_TOOL_NAMES).toHaveLength(37);expect(MCP_LIMITS.package).toBe(1048576);expect(MCP_LIMITS.result).toBe(524288);
 expect(()=>intersectMcpCapabilities(['blocking.v1','blocking.v1'],MCP_BLOCKING_CAPABILITIES)).toThrow();
});
it('rejects changed, missing and downgraded transcript capability fields',()=>{
 const good={clientCapabilities:[...MCP_BLOCKING_CAPABILITIES],serverCapabilities:[...MCP_BLOCKING_CAPABILITIES],capabilities:[...MCP_BLOCKING_CAPABILITIES]};
 expect(validateCapabilityTranscript(good,MCP_BLOCKING_CAPABILITIES)).toEqual(MCP_BLOCKING_CAPABILITIES);
 for(const change of [{capabilities:[]},{clientCapabilities:[]},{serverCapabilities:[]},{capabilities:undefined}])expect(()=>validateCapabilityTranscript({...good,...change},MCP_BLOCKING_CAPABILITIES)).toThrow();
});
it('does not promote a live v1 broker or authorize scope2 without authenticated peer capabilities',()=>{
 const broker=new ProposalBroker();expect(()=>broker.connect('unsupported',emptyMcpScopeV2())).toThrow(/update|pairing/i);expect(broker.getState().connected).toBe(false);
 broker.connect('legacy',emptyMcpScope());expect(()=>broker.setScope(emptyMcpScopeV2())).toThrow(/fresh|pairing/i);expect(broker.getState().scope.version).toBe(1);
 broker.disconnect();broker.connect('new',emptyMcpScopeV2(),Date.now()+60000,MCP_BLOCKING_CAPABILITIES);expect(broker.getState().scope.version).toBe(2);broker.disconnect();
});
