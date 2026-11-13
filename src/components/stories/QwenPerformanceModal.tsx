import React, { useState, useEffect, useRef } from 'react';
import type { QwenHardwareSettings, QwenServerStatus, QwenProcessMetrics, QwenGenerationTelemetry } from '../../types/qwen';
import { getQwenProcessMetrics } from '../../services/qwenClient';
import { Activity, Cpu, HardDrive, Zap, X, Clock, Gauge, Thermometer, Sparkles, Layers } from 'lucide-react';
import './qwenCoPilot.css';

export interface QwenPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorPosition: { x: number; y: number };
  chatBounds?: { left: number; right: number; top: number; bottom: number } | null;
  hardware: QwenHardwareSettings;
  status: QwenServerStatus;
  telemetry?: Partial<QwenGenerationTelemetry>;
}

export const QwenPerformanceModal: React.FC<QwenPerformanceModalProps> = ({
  isOpen,
  onClose,
  anchorPosition,
  chatBounds,
  hardware,
  status,
  telemetry,
}) => {
  const [metrics, setMetrics] = useState<QwenProcessMetrics | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(16, anchorPosition.x - 330),
    y: Math.max(16, anchorPosition.y + 40),
  }));

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

  // Update initial position when anchor or chatBounds change
  useEffect(() => {
    setPos(() => {
      let targetX = anchorPosition.x;
      let targetY = anchorPosition.y;

      if (chatBounds) {
        const modalWidth = 320;
        // Default to left of chat panel with a solid 14px boundary gap
        if (chatBounds.left - modalWidth - 14 >= 16) {
          targetX = chatBounds.left - modalWidth - 14;
        } else {
          // If no room on left, dock to right of chat panel
          targetX = chatBounds.right + 14;
        }
        targetY = Math.max(16, Math.min(window.innerHeight - 380, chatBounds.top + 10));
      }

      return {
        x: Math.max(16, Math.min(window.innerWidth - 330, targetX)),
        y: Math.max(16, Math.min(window.innerHeight - 380, targetY)),
      };
    });
  }, [anchorPosition.x, anchorPosition.y, chatBounds?.left, chatBounds?.right, chatBounds?.top]);

  // Poll metrics every 2s when open and awake
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        const data = await getQwenProcessMetrics();
        if (isMounted) {
          setMetrics(data);
        }
      } catch {
        // ignore fetch error if server offline
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, status.state]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvt.clientX - dragStartRef.current.startX;
      const deltaY = moveEvt.clientY - dragStartRef.current.startY;
      const rawX = dragStartRef.current.initX + deltaX;
      const rawY = dragStartRef.current.initY + deltaY;

      let clampedX = Math.max(12, Math.min(window.innerWidth - 330, rawX));
      let clampedY = Math.max(12, Math.min(window.innerHeight - 380, rawY));

      // Mutual non-overlapping boundary check against chat panel
      if (chatBounds) {
        const modalWidth = 320;
        const modalHeight = 360;
        const modalRight = clampedX + modalWidth;
        const modalBottom = clampedY + modalHeight;

        const overlapsX = clampedX < chatBounds.right && modalRight > chatBounds.left;
        const overlapsY = clampedY < chatBounds.bottom && modalBottom > chatBounds.top;

        if (overlapsX && overlapsY) {
          const distToLeft = Math.abs(clampedX - (chatBounds.left - modalWidth - 14));
          const distToRight = Math.abs(clampedX - (chatBounds.right + 14));
          if (distToLeft < distToRight && chatBounds.left - modalWidth - 14 >= 12) {
            clampedX = chatBounds.left - modalWidth - 14;
          } else if (chatBounds.right + 14 <= window.innerWidth - modalWidth - 12) {
            clampedX = chatBounds.right + 14;
          }
        }
      }

      setPos({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  const formattedRam = metrics
    ? `${Math.round(metrics.ramWorkingSetMb).toLocaleString()} MB`
    : (status.state === 'awake' ? 'Querying...' : '0 MB');
  const uptimeSeconds = metrics?.uptimeSeconds ?? 0;
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeSecsRemainder = uptimeSeconds % 60;
  const formattedUptime = `${uptimeMinutes}m ${uptimeSecsRemainder}s`;

  const sparklineData = telemetry?.speedHistory && telemetry.speedHistory.length > 0
    ? telemetry.speedHistory
    : [];

  const maxSpeed = Math.max(30, ...(sparklineData.length > 0 ? sparklineData : [0]));
  const sparklinePoints = sparklineData.length > 1
    ? sparklineData
        .map((val, idx) => {
          const x = (idx / Math.max(1, sparklineData.length - 1)) * 140;
          const y = 30 - (val / maxSpeed) * 26;
          return `${x},${y}`;
        })
        .join(' ')
    : '0,16 140,16';

  const runningContext = metrics?.contextSize || hardware.contextSize || 8192;
  const targetContext = hardware.contextSize || 8192;
  const isContextPendingRestart = Boolean(metrics?.contextSize && metrics.contextSize !== targetContext);
  const contextMax = runningContext;
  const totalTokens = telemetry?.totalTokens ?? 0;
  const tokenPct = Math.min(100, Math.round((totalTokens / contextMax) * 100));

  const cpuPercent = metrics?.cpuPercent ?? 0;
  const gpuPercent = metrics?.gpuPercent;
  const vramUsedMb = metrics?.vramUsedMb;
  const vramTotalMb = metrics?.vramTotalMb;
  const tempC = metrics?.temperatureC;
  const vramPct =
    vramUsedMb && vramTotalMb ? Math.min(100, Math.round((vramUsedMb / vramTotalMb) * 100)) : 0;

  const thinkingTokens = telemetry?.thinkingTokens ?? 0;
  const answerTokens = telemetry?.answerTokens ?? 0;
  const generatedTokens = telemetry?.generatedTokens ?? 0;

  return (
    <div
      className="qwen-performance-modal"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      role="dialog"
      aria-label="Qwen Performance Monitor"
    >
      {/* Header with Drag Handle */}
      <div className="qwen-performance-header" onMouseDown={handleMouseDown}>
        <div className="performance-title">
          <Activity size={16} className="text-cyan" />
          <span>Qwen Performance Monitor</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="performance-close-btn"
          aria-label="Close Performance Monitor"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="qwen-performance-body">
        {/* CPU & GPU Hardware Load Tile */}
        <div className="performance-tile">
          <div className="tile-icon">
            <Cpu size={18} className="text-cyan" />
          </div>
          <div className="tile-content" style={{ width: '100%' }}>
            <div className="tile-label">CPU & GPU Utilization</div>
            <div className="tile-value-row">
              <span className="tile-value">
                CPU: {cpuPercent}%
                {gpuPercent !== null && gpuPercent !== undefined ? ` • GPU: ${gpuPercent}%` : ''}
              </span>
              {tempC !== null && tempC !== undefined && (
                <span
                  className={`temperature-pill ${tempC >= 80 ? 'critical' : tempC >= 65 ? 'warning' : 'normal'}`}
                  title="GPU Core Temperature"
                >
                  <Thermometer size={11} />
                  {tempC}°C
                </span>
              )}
            </div>
            {/* CPU & GPU load bars */}
            <div className="performance-dual-bar">
              <div className="bar-wrapper">
                <span className="bar-sub">CPU</span>
                <div className="performance-bar-track">
                  <div
                    className={`performance-bar-fill ${cpuPercent > 85 ? 'critical' : cpuPercent > 60 ? 'warning' : 'normal'}`}
                    style={{ width: `${Math.min(100, cpuPercent)}%` }}
                  />
                </div>
              </div>
              {gpuPercent !== null && gpuPercent !== undefined && (
                <div className="bar-wrapper">
                  <span className="bar-sub">GPU</span>
                  <div className="performance-bar-track">
                    <div
                      className={`performance-bar-fill ${gpuPercent > 85 ? 'critical' : gpuPercent > 60 ? 'warning' : 'normal'}`}
                      style={{ width: `${Math.min(100, gpuPercent)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CUDA VRAM & RAM Working Set Tile */}
        <div className="performance-tile">
          <div className="tile-icon">
            <HardDrive size={18} className="text-emerald" />
          </div>
          <div className="tile-content" style={{ width: '100%' }}>
            <div className="tile-label">RAM & CUDA VRAM Allocation</div>
            <div className="tile-value-row">
              <span className="tile-value">RAM: {formattedRam}</span>
              {vramUsedMb !== null && vramUsedMb !== undefined ? (
                <span className="tile-sub">
                  VRAM: {vramUsedMb} / {vramTotalMb || 8192} MB ({vramPct}%)
                </span>
              ) : (
                <span className="tile-sub">Target: {hardware.fitTargetMb || 1536} MB</span>
              )}
            </div>
            {vramUsedMb !== null && vramUsedMb !== undefined && (
              <div className="performance-bar-track">
                <div
                  className={`performance-bar-fill ${vramPct > 90 ? 'critical' : vramPct > 70 ? 'warning' : 'normal'}`}
                  style={{ width: `${vramPct}%` }}
                />
              </div>
            )}
            <div className="tile-footer">
              PID: {status.pid ?? metrics?.pid ?? 'N/A'} • {metrics?.gpuDeviceName || 'CUDA Accelerated'}
            </div>
          </div>
        </div>

        {/* Live Thinking Tokens & Generation Speed Tile */}
        <div className="performance-tile">
          <div className="tile-icon">
            <Sparkles size={18} className="text-purple" />
          </div>
          <div className="tile-content" style={{ width: '100%' }}>
            <div className="tile-label">Live Thinking & Speed</div>
            <div className="tile-value-row">
              <span className="tile-value">
                {telemetry?.isGenerating && telemetry?.ttftMs === null
                  ? '⚡ Evaluating prompt...'
                  : thinkingTokens > 0
                  ? `💭 Thinking: ${thinkingTokens.toLocaleString()} tok`
                  : answerTokens > 0 || generatedTokens > 0
                  ? `✍️ Generated: ${(answerTokens || generatedTokens).toLocaleString()} tok`
                  : '💭 Thinking: 0 tok'}
              </span>
              <span className="tile-sub">
                {telemetry?.isGenerating
                  ? telemetry?.ttftMs === null
                    ? '⚡ Prefill in progress...'
                    : telemetry?.taskName || (thinkingTokens > 0 ? 'Actively Reasoning' : 'Generating Response')
                  : 'Ready'}
              </span>
            </div>
            <div className="tile-value-row" style={{ marginTop: '4px' }}>
              <span className="tile-sub">
                Speed: {telemetry?.currentSpeedTokPerSec ? `${telemetry.currentSpeedTokPerSec.toFixed(1)} tok/s` : 'Idle'}
              </span>
              <span className="tile-sub">
                TTFT: {telemetry?.ttftMs !== null && telemetry?.ttftMs !== undefined ? `${telemetry.ttftMs}ms` : '—'}
              </span>
            </div>
            <div className="sparkline-wrapper">
              <svg width="140" height="28" className="speed-sparkline">
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
              <span className="sparkline-peak">
                Peak: {telemetry?.peakSpeedTokPerSec ? `${telemetry.peakSpeedTokPerSec.toFixed(1)} t/s` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Token Context Tile */}
        <div className="performance-tile">
          <div className="tile-icon">
            <Gauge size={18} className="text-amber" />
          </div>
          <div className="tile-content" style={{ width: '100%' }}>
            <div className="tile-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Context Window Budget</span>
              {isContextPendingRestart && (
                <span className="context-restart-warning-badge" title="Context size setting was changed. Restart server to apply.">
                  ⚡ Restart Required
                </span>
              )}
            </div>
            <div className="tile-value-row">
              <span className="tile-value">{totalTokens.toLocaleString()} / {runningContext.toLocaleString()}</span>
              <span className="tile-sub">{tokenPct}% Used</span>
            </div>
            <div className="performance-bar-track">
              <div
                className={`performance-bar-fill ${tokenPct > 80 ? 'critical' : tokenPct > 50 ? 'warning' : 'normal'}`}
                style={{ width: `${tokenPct}%` }}
              />
            </div>
            {isContextPendingRestart && (
              <div className="context-pending-note">
                Active server: {runningContext.toLocaleString()} tok • Configured: {targetContext.toLocaleString()} tok
              </div>
            )}
          </div>
        </div>

        {/* Engine Uptime & Port */}
        <div className="performance-meta-footer">
          <div className="meta-item">
            <Clock size={12} />
            <span>Uptime: {formattedUptime}</span>
          </div>
          <div className="meta-item">
            <Cpu size={12} />
            <span>Port: {status.port || 8080}</span>
          </div>
          <div className="meta-item">
            <span className={`status-pill ${status.state}`}>{status.state.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
