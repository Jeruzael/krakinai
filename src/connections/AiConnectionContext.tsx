import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { authorizedSceneIds, emptyMcpScope, validateMcpScope } from '../domain/mcpScope';
import type { McpScope } from '../types/mcp';
import { BrowserTransport, type PairingView } from './browserTransport';
import { ProposalBroker, type BrokerView } from './proposalBroker';

interface ConnectionValue {
  broker: ProposalBroker; view: BrokerView; scope: McpScope;
  phase: 'disconnected' | 'pairing' | 'connected' | 'error'; message: string; pairing?: PairingView; librarySession: string;
  setPermissions(scope: McpScope): void; beginPairing(address: string): Promise<void>;
  finishPairing(secret: string): Promise<void>; disconnect(): Promise<void>;
}
const Context = createContext<ConnectionValue | null>(null);
export function useAiConnectionOptional() { return useContext(Context); }
export function useAiConnection() { const value = useContext(Context); if (!value) throw Error('AI connection provider is unavailable.'); return value; }
export function AiConnectionProvider({ children }: { children: React.ReactNode }) {
  const library = useLibrary(), libraryRef = useRef(library); libraryRef.current = library;
  const transportRef = useRef<BrowserTransport>(), brokerRef = useRef<ProposalBroker>(), mounted = useRef(true);
  const [draftScope, setDraftScope] = useState(emptyMcpScope), scopeRef = useRef(draftScope); scopeRef.current = draftScope;
  const [phase, setPhase] = useState<ConnectionValue['phase']>('disconnected'), [message, setMessage] = useState(''), [pairing, setPairing] = useState<PairingView>();
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const [librarySession] = useState(() => `browser_${crypto.randomUUID().slice(0, 8)}`);
  if (!brokerRef.current) brokerRef.current = new ProposalBroker({ isSessionLive: id => transportRef.current?.isSessionLive(id) ?? false, onApplied: async () => { await libraryRef.current.refreshSnapshot(); } });
  const broker = brokerRef.current, view = useSyncExternalStore(broker.subscribe, broker.getState, broker.getState);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => { broker.expire(); const current = broker.getState(); if (!current.connected && transportRef.current && phaseRef.current === 'connected') void transportRef.current.disconnect('The authorized session expired. Pair again.'); }, 1000);
    return () => { mounted.current = false; clearInterval(timer); const client = transportRef.current; transportRef.current = undefined; broker.disconnect(); void client?.disconnect(); };
  }, [broker]);
  function setPermissions(next: McpScope) {
    const copy = validateMcpScope(next), snapshot = libraryRef.current.snapshot;
    if (snapshot) { const scenes = authorizedSceneIds(copy, snapshot); copy.fullPromptSceneIds = copy.fullPromptSceneIds.filter(id => scenes.has(id)); }
    if (broker.getState().connected) broker.setScope(copy);
    scopeRef.current = copy; setDraftScope(copy);
  }
  async function beginPairing(address: string) {
    const selected = validateMcpScope(scopeRef.current), old = transportRef.current;
    if (old) { transportRef.current = undefined; await old.disconnect(); }
    setMessage(''); setPairing(undefined);
    const client = new BrowserTransport({ relayAddress: address, appOrigin: window.location.origin,
      onConnected(id, grant) { if (transportRef.current !== client) return; broker.connect(id, selected, grant.expiresAt); if (mounted.current) { setPhase('connected'); setPairing(undefined); setMessage('Connected. Every application still requires your review and approval here.'); } },
      onDisconnected(reason) { if (transportRef.current !== client) return; transportRef.current = undefined; broker.disconnect(); if (mounted.current) { setPhase('disconnected'); setPairing(undefined); setMessage(reason); setDraftScope(emptyMcpScope()); } },
      onCommand: (command, sessionId) => broker.handle(command, sessionId),
    });
    transportRef.current = client;
    try { const info = await client.startPairing(); if (transportRef.current === client && mounted.current) { setPairing(info); setPhase('pairing'); } }
    catch (error) { if (mounted.current) { setPhase('error'); setMessage(error instanceof Error ? error.message : 'The local bridge could not be reached.'); } }
  }
  async function finishPairing(secret: string) { const client = transportRef.current; if (!client) throw Error('Start pairing first.'); await client.finishPairing(secret); }
  async function disconnect() { const client = transportRef.current; if (client) await client.disconnect(); else { broker.disconnect(); setPhase('disconnected'); setPairing(undefined); setDraftScope(emptyMcpScope()); } }
  return <Context.Provider value={{ broker, view, scope: view.connected ? view.scope : draftScope, phase, message, pairing, librarySession, setPermissions, beginPairing, finishPairing, disconnect }}>{children}</Context.Provider>;
}
