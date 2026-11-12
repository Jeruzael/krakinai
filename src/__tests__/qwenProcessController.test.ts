import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QwenProcessController } from '../server/qwenProcessController';
import { DEFAULT_QWEN_SETTINGS } from '../storage/qwenSettings';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

describe('QwenProcessController', () => {
  let controller: QwenProcessController;

  beforeEach(() => {
    controller = new QwenProcessController();
  });

  afterEach(async () => {
    await controller.stop();
  });

  it('initializes with sleeping state', () => {
    const status = controller.getStatus();
    expect(status.state).toBe('sleeping');
    expect(status.pid).toBeNull();
    expect(status.modelReady).toBe(false);
    expect(status.lastError).toBeNull();
  });

  it('starts process and transitions to awake when health check succeeds', async () => {
    const mockChild = new EventEmitter() as unknown as ChildProcess;
    Object.assign(mockChild, {
      pid: 12345,
      kill: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null,
    });

    const spawnSpy = vi.fn().mockReturnValue(mockChild);
    const healthProbeSpy = vi.fn().mockResolvedValue(true);

    controller._injectDependencies({
      spawn: spawnSpy as unknown as typeof import('node:child_process').spawn,
      probeHealth: healthProbeSpy,
      killProcessTree: vi.fn().mockResolvedValue(undefined),
    });

    const startPromise = controller.start(DEFAULT_QWEN_SETTINGS.hardware);
    const statusWaking = controller.getStatus();
    expect(statusWaking.state).toBe('waking');
    expect(statusWaking.pid).toBe(12345);

    await startPromise;

    const statusAwake = controller.getStatus();
    expect(statusAwake.state).toBe('awake');
    expect(statusAwake.modelReady).toBe(true);
    expect(spawnSpy).toHaveBeenCalled();
  });

  it('stops process and transitions to sleeping', async () => {
    const mockChild = new EventEmitter() as unknown as ChildProcess;
    const killTreeSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(mockChild, {
      pid: 12345,
      kill: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null,
    });

    controller._injectDependencies({
      spawn: vi.fn().mockReturnValue(mockChild) as unknown as typeof import('node:child_process').spawn,
      probeHealth: vi.fn().mockResolvedValue(true),
      killProcessTree: killTreeSpy,
    });

    await controller.start(DEFAULT_QWEN_SETTINGS.hardware);
    expect(controller.getStatus().state).toBe('awake');

    await controller.stop();
    const status = controller.getStatus();
    expect(status.state).toBe('sleeping');
    expect(status.pid).toBeNull();
    expect(status.modelReady).toBe(false);
    expect(killTreeSpy).toHaveBeenCalledWith(12345, DEFAULT_QWEN_SETTINGS.hardware.modelPath);
  });

  it('handles unexpected process exit and sets error state', async () => {
    const mockChild = new EventEmitter() as unknown as ChildProcess;
    Object.assign(mockChild, {
      pid: 12345,
      kill: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null,
    });

    controller._injectDependencies({
      spawn: vi.fn().mockReturnValue(mockChild) as unknown as typeof import('node:child_process').spawn,
      probeHealth: vi.fn().mockResolvedValue(true),
      killProcessTree: vi.fn().mockResolvedValue(undefined),
    });

    await controller.start(DEFAULT_QWEN_SETTINGS.hardware);
    expect(controller.getStatus().state).toBe('awake');

    mockChild.emit('exit', 1, null);

    const status = controller.getStatus();
    expect(status.state).toBe('error');
    expect(status.lastError).toContain('exited unexpectedly with code 1');
  });

  it('serves status through createQwenMiddleware', async () => {
    const { createQwenMiddleware } = await import('../server/qwenProcessController');
    const middleware = createQwenMiddleware(controller);

    const req = {
      url: '/api/qwen/control/status',
      method: 'GET',
    } as unknown as import('node:http').IncomingMessage;

    let responseData = '';
    const res = {
      setHeader: vi.fn(),
      end: vi.fn((data?: string) => {
        responseData = data || '';
      }),
    } as unknown as import('node:http').ServerResponse;

    const next = vi.fn();
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    const parsed = JSON.parse(responseData);
    expect(parsed.state).toBe('sleeping');
  });

  it('returns default metrics when sleeping', async () => {
    const metrics = await controller.getMetrics();
    expect(metrics.state).toBe('sleeping');
    expect(metrics.pid).toBeNull();
    expect(metrics.ramWorkingSetMb).toBe(0);
    expect(metrics.cpuPercent).toBe(0);
    expect(metrics.uptimeSeconds).toBe(0);
    expect(metrics.contextSize).toBe(DEFAULT_QWEN_SETTINGS.hardware.contextSize);
    expect(metrics.fitTargetMb).toBe(DEFAULT_QWEN_SETTINGS.hardware.fitTargetMb);
  });

  it('returns active process metrics when awake and serves via middleware', async () => {
    const mockChild = new EventEmitter() as unknown as ChildProcess;
    Object.assign(mockChild, {
      pid: 14820,
      kill: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null,
    });

    controller._injectDependencies({
      spawn: vi.fn().mockReturnValue(mockChild) as unknown as typeof import('node:child_process').spawn,
      probeHealth: vi.fn().mockResolvedValue(true),
      killProcessTree: vi.fn().mockResolvedValue(undefined),
      queryMetrics: vi.fn().mockResolvedValue({ ramWorkingSetMb: 5703, cpuPercent: 12.5 }),
    });

    await controller.start({
      ...DEFAULT_QWEN_SETTINGS.hardware,
      contextSize: 8192,
      fitTargetMb: 1536,
    });

    const metrics = await controller.getMetrics();
    expect(metrics.state).toBe('awake');
    expect(metrics.pid).toBe(14820);
    expect(metrics.ramWorkingSetMb).toBe(5703);
    expect(metrics.cpuPercent).toBe(12.5);
    expect(metrics.contextSize).toBe(8192);
    expect(metrics.fitTargetMb).toBe(1536);
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);

    // Test middleware endpoint GET /api/qwen/control/metrics
    const { createQwenMiddleware } = await import('../server/qwenProcessController');
    const middleware = createQwenMiddleware(controller);

    const req = {
      url: '/api/qwen/control/metrics',
      method: 'GET',
    } as unknown as import('node:http').IncomingMessage;

    let responseData = '';
    const res = {
      setHeader: vi.fn(),
      end: vi.fn((data?: string) => {
        responseData = data || '';
      }),
    } as unknown as import('node:http').ServerResponse;

    const next = vi.fn();
    middleware(req, res, next);

    // Allow promise in middleware to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    const parsed = JSON.parse(responseData);
    expect(parsed.state).toBe('awake');
    expect(parsed.ramWorkingSetMb).toBe(5703);
    expect(parsed.cpuPercent).toBe(12.5);
  });
});
