import React from 'react';
import { useQwen } from '../../context/QwenContext';
import './qwenCoPilot.css';

export const QwenTopbarBed: React.FC = () => {
  const { status, isHoveringBed, wakeQwen, sleepQwen, bedElementRef } = useQwen();

  const isSleeping = status.state === 'sleeping';
  const isWaking = status.state === 'waking';
  const isStopping = status.state === 'stopping';

  if (isWaking) {
    return (
      <div
        ref={bedElementRef}
        role="status"
        aria-label="Waking Qwen"
        className="qwen-topbar-bed waking"
        title="Waking up local Qwen 3.5 (~3-6s)..."
      >
        <span className="bed-icon">⏳</span>
        <span className="bed-status-text">Waking Qwen...</span>
      </div>
    );
  }

  if (isSleeping || isStopping) {
    return (
      <div
        ref={bedElementRef}
        role="region"
        aria-label="Qwen's Bed"
        className="qwen-topbar-bed sleeping"
        title="Qwen is sleeping (0 MB RAM/VRAM). Click Wake to launch."
      >
        <span className="bed-icon">🛏️</span>
        <span className="bed-status-text">Qwen (0 MB)</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void wakeQwen();
          }}
          disabled={isStopping}
          className="wake-pill-btn"
          aria-label="Wake Qwen"
        >
          ☀️ Wake
        </button>
      </div>
    );
  }

  // Awake / Active state
  return (
    <div
      ref={bedElementRef}
      role="region"
      aria-label="Qwen's Bed"
      className={`qwen-topbar-bed awake ${isHoveringBed ? 'bed-drop-hover' : ''}`}
      title={isHoveringBed ? 'Release to put Qwen to sleep & free RAM/VRAM' : "Qwen is running. Drop Qwen's avatar here or click Sleep."}
    >
      <span className="bed-icon">🛏️</span>
      <span className="bed-status-text">
        {isHoveringBed ? 'Release to Sleep' : "Qwen's Bed"}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void sleepQwen();
        }}
        className="sleep-pill-btn"
        aria-label="Sleep Qwen"
      >
        🌙 Sleep
      </button>
    </div>
  );
};
