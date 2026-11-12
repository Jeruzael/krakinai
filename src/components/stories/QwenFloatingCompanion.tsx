import React, { useState, useEffect, useRef } from 'react';
import type { Story } from '../../types/domain';
import type { CreatorModeSelection, QwenStoryPatchAction } from '../../types/qwen';
import { useQwen } from '../../context/QwenContext';
import { QwenCoPilotPanel } from './QwenCoPilotPanel';
import { QwenSettingsModal } from './QwenSettingsModal';
import { QwenPerformanceModal } from './QwenPerformanceModal';
import { QwenWordLookupPopover } from './QwenWordLookupPopover';
import { Activity } from 'lucide-react';
import './qwenCoPilot.css';

interface QwenFloatingCompanionProps {
  story?: Story;
  mode?: 'pitch' | 'creator' | 'book';
  selection?: CreatorModeSelection;
  onApplyStoryPatch?: (action: QwenStoryPatchAction) => void;
  referencedAssets?: Array<{ id: string; name: string; kind?: string }>;
}

export const QwenFloatingCompanion: React.FC<QwenFloatingCompanionProps> = ({
  story: propStory,
  mode: propMode,
  selection: propSelection,
  onApplyStoryPatch: propOnApplyStoryPatch,
  referencedAssets: propReferencedAssets,
}) => {
  const {
    settings,
    status,
    isPanelOpen,
    isSettingsOpen,
    isRestarting,
    activeStoryBinding,
    bedElementRef,
    setIsPanelOpen,
    setIsSettingsOpen,
    setIsHoveringBed,
    setIsDraggingAvatar,
    wakeQwen,
    sleepQwen,
    saveSettings,
    telemetry,
    applyAndRestart,
    updateAvatarPosition,
  } = useQwen();

  // Resolved context: props take precedence if passed (e.g. from StoryWorkspaceScreen), otherwise activeStoryBinding
  const effectiveStory = propStory || activeStoryBinding?.story;
  const effectiveMode = propMode || activeStoryBinding?.mode || 'pitch';
  const effectiveSelection = propSelection || activeStoryBinding?.selection;
  const effectiveOnApply = propOnApplyStoryPatch || activeStoryBinding?.onApplyStoryPatch;
  const effectiveReferencedAssets = propReferencedAssets || activeStoryBinding?.referencedAssets;

  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const didDragRef = useRef(false);

  const isDocked = status.state === 'sleeping' || settings.isDockedInBed;

  // Immediate Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    setIsDraggingAvatar(true);

    const currX = settings.companionPosition?.x ?? Math.max(20, window.innerWidth - 90);
    const currY = settings.companionPosition?.y ?? 90;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const deltaY = moveEvt.clientY - startY;
      if (Math.hypot(deltaX, deltaY) > 5) {
        didDragRef.current = true;
      }
      const rawX = currX + deltaX;
      const rawY = currY + deltaY;

      // Viewport clamping
      const clampedX = Math.max(16, Math.min(window.innerWidth - 72, rawX));
      const clampedY = Math.max(16, Math.min(window.innerHeight - 72, rawY));

      updateAvatarPosition({ x: clampedX, y: clampedY });

      // Check if hovering over the topbar bed
      if (bedElementRef.current) {
        const bedRect = bedElementRef.current.getBoundingClientRect();
        const isOverBed =
          moveEvt.clientX >= bedRect.left - 20 &&
          moveEvt.clientX <= bedRect.right + 20 &&
          moveEvt.clientY >= bedRect.top - 10 &&
          moveEvt.clientY <= bedRect.bottom + 20;
        setIsHoveringBed(isOverBed);
      }
    };

    const handleMouseUp = (upEvt: MouseEvent) => {
      setIsDraggingAvatar(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (bedElementRef.current) {
        const bedRect = bedElementRef.current.getBoundingClientRect();
        const droppedInBed =
          upEvt.clientX >= bedRect.left - 20 &&
          upEvt.clientX <= bedRect.right + 20 &&
          upEvt.clientY >= bedRect.top - 10 &&
          upEvt.clientY <= bedRect.bottom + 20;

        if (droppedInBed) {
          void sleepQwen();
          return;
        }
      }
      setIsHoveringBed(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // When sleeping in bed, avatar is docked in topbar bed, so no floating widget on canvas
  if (isDocked) {
    return null;
  }

  const posX = settings.companionPosition?.x ?? Math.max(20, window.innerWidth - 90);
  const posY = settings.companionPosition?.y ?? 90;

  const chatLeft =
    posX > window.innerWidth / 2
      ? Math.max(16, posX - 450)
      : Math.min(window.innerWidth - 460, posX + 70);
  const chatTop = Math.max(70, Math.min(window.innerHeight - 660, posY - 20));
  const chatBounds = isPanelOpen
    ? { left: chatLeft, right: chatLeft + 440, top: chatTop, bottom: chatTop + 640 }
    : null;

  return (
    <>
      {/* Draggable Floating Companion Icon */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Qwen Companion"
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (didDragRef.current) {
            didDragRef.current = false;
            e.stopPropagation();
            return;
          }
          setIsPanelOpen(!isPanelOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsPanelOpen(!isPanelOpen);
          }
        }}
        style={{
          left: `${posX}px`,
          top: `${posY}px`,
        }}
        className="qwen-floating-avatar"
        title="Local Qwen 3.5 is Awake! Click to open Co-Pilot or drag to topbar bed to sleep."
      >
        <span className="avatar-emoji">🤖</span>
        <span
          className={`status-dot ${
            status.state === 'awake' ? 'awake' : status.state === 'waking' ? 'waking' : 'error'
          }`}
        />
      </div>

      {/* Satellite Performance Sub-Icon beneath avatar */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Qwen Performance Monitor"
        className={`qwen-satellite-icon ${isPerformanceOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsPerformanceOpen(!isPerformanceOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsPerformanceOpen(!isPerformanceOpen);
          }
        }}
        style={{
          left: `${posX + 10}px`,
          top: `${posY + 58}px`,
        }}
        title="Collapsible Qwen Performance Monitor (Real RAM, tok/s, TTFT & context tracking)"
      >
        <Activity size={15} className="satellite-pulse-icon" />
      </div>

      {/* Floating Draggable Performance Monitor Modal */}
      <QwenPerformanceModal
        isOpen={isPerformanceOpen}
        onClose={() => setIsPerformanceOpen(false)}
        anchorPosition={{ x: posX, y: posY }}
        chatBounds={chatBounds}
        hardware={settings.hardware}
        status={status}
        telemetry={telemetry}
      />

      {/* Co-Pilot Panel */}
      <QwenCoPilotPanel
        isOpen={isPanelOpen}
        story={
          effectiveStory || {
            id: 'global-workspace',
            title: 'KRAKINAI Creative Session',
            author: 'Current User',
            tags: [],
            coverMediaId: null,
            heroBannerMediaId: null,
            logline: '',
            premise: '',
            synopsis: '',
            treatment: '',
            fullBookText: '',
            referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
            linkedCollectionId: null,
            colorScript: [],
            acts: [],
            favorite: false,
            revisionNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        }
        mode={effectiveMode}
        selection={effectiveSelection}
        settings={settings}
        status={status}
        onClose={() => setIsPanelOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onApplyStoryPatch={effectiveOnApply || (() => {})}
        referencedAssets={effectiveReferencedAssets}
        positionAnchor={{ x: posX, y: posY }}
      />

      {/* Auto-Definition Highlight Popover */}
      <QwenWordLookupPopover
        settings={settings}
        isServerAwake={status.state === 'awake'}
        onWakeQwen={wakeQwen}
      />

      {/* Settings Modal */}
      <QwenSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={saveSettings}
        onApplyAndRestart={applyAndRestart}
        isRestarting={isRestarting}
      />
    </>
  );
};
