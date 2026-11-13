import { spawn as defaultSpawn, exec as defaultExec, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import type { Plugin, Connect } from 'vite';
import type { QwenHardwareSettings, QwenServerStatus, QwenProcessMetrics } from '../types/qwen';
import { buildLlamaServerArgs, validateHardwareSettings, DEFAULT_QWEN_SETTINGS } from '../storage/qwenSettings';

interface InjectedDeps {
  spawn: typeof defaultSpawn;
  probeHealth: (port: number) => Promise<boolean>;
  killProcessTree: (pid: number | null, modelPath?: string) => Promise<void>;
  queryMetrics?: (pid: number) => Promise<{
    ramWorkingSetMb: number;
    cpuPercent: number;
    gpuPercent?: number | null;
    vramUsedMb?: number | null;
    vramTotalMb?: number | null;
    temperatureC?: number | null;
    gpuDeviceName?: string | null;
  }>;
}

export class QwenProcessController {
  private childProcess: ChildProcess | null = null;
  private currentHardware: QwenHardwareSettings = { ...DEFAULT_QWEN_SETTINGS.hardware };
  private state: QwenServerStatus['state'] = 'sleeping';
  private lastError: string | null = null;
  private activePort: number = DEFAULT_QWEN_SETTINGS.hardware.port;
  private startTime: number | null = null;
  private lastCpuSample: { idle: number; total: number } | null = null;
  private lastGpuMetrics: {
    gpuPercent: number | null;
    vramUsedMb: number | null;
    vramTotalMb: number | null;
    temperatureC: number | null;
    gpuDeviceName: string | null;
    timestamp: number;
  } | null = null;

  private deps: InjectedDeps;

  constructor() {
    this.deps = {
      spawn: defaultSpawn,
      probeHealth: this.defaultProbeHealth.bind(this),
      killProcessTree: this.defaultKillProcessTree.bind(this),
    };
  }

  public _injectDependencies(partial: Partial<InjectedDeps>): void {
    this.deps = { ...this.deps, ...partial };
  }

  public getStatus(): QwenServerStatus {
    return {
      state: this.state,
      pid: this.childProcess?.pid ?? null,
      port: this.activePort,
      modelReady: this.state === 'awake',
      lastError: this.lastError,
    };
  }

  public async start(hardware?: QwenHardwareSettings): Promise<QwenServerStatus> {
    const hw = hardware || this.currentHardware;
    validateHardwareSettings(hw);
    this.currentHardware = { ...hw };
    this.activePort = hw.port;

    if (this.state === 'awake' && this.childProcess) {
      return this.getStatus();
    }

    if (this.childProcess || this.state !== 'sleeping') {
      await this.stop();
    }

    this.state = 'waking';
    this.lastError = null;

    const args = buildLlamaServerArgs(hw);

    try {
      const child = this.deps.spawn(hw.executablePath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.childProcess = child;

      child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        if (this.childProcess === child) {
          this.childProcess = null;
          this.startTime = null;
          if (this.state !== 'sleeping' && this.state !== 'stopping') {
            this.state = 'error';
            this.lastError = `llama-server exited unexpectedly with code ${code ?? signal}`;
          }
        }
      });

      child.on('error', (err: Error) => {
        if (this.childProcess === child) {
          this.state = 'error';
          this.lastError = `Failed to spawn llama-server: ${err.message}`;
          this.childProcess = null;
          this.startTime = null;
        }
      });

      // Poll health endpoint
      const healthy = await this.waitForHealth(hw.port, 25000);
      if (healthy && this.childProcess) {
        this.state = 'awake';
        this.lastError = null;
        this.startTime = Date.now();
      } else if ((this.state as QwenServerStatus['state']) !== 'error') {
        this.state = 'error';
        this.lastError = 'Server launched but health check timed out.';
      }
    } catch (err) {
      this.state = 'error';
      this.lastError = (err as Error).message;
      this.childProcess = null;
      this.startTime = null;
    }

    return this.getStatus();
  }

  public async stop(): Promise<QwenServerStatus> {
    this.state = 'stopping';
    this.startTime = null;
    const pid = this.childProcess?.pid ?? null;
    const modelPath = this.currentHardware?.modelPath;

    if (this.childProcess) {
      try {
        this.childProcess.kill();
      } catch {
        // ignore
      }
      this.childProcess = null;
    }

    try {
      await this.deps.killProcessTree(pid, modelPath);
    } catch {
      // ignore
    }

    this.state = 'sleeping';
    this.lastError = null;
    return this.getStatus();
  }

  public async restart(hardware?: QwenHardwareSettings): Promise<QwenServerStatus> {
    await this.stop();
    return this.start(hardware);
  }

  public async getMetrics(): Promise<QwenProcessMetrics> {
    const pid = this.childProcess?.pid ?? null;
    let ramWorkingSetMb = 0;
    let cpuPercent = this.calculateCpuPercent();
    let gpuPercent: number | null = null;
    let vramUsedMb: number | null = null;
    let vramTotalMb: number | null = null;
    let temperatureC: number | null = null;
    let gpuDeviceName: string | null = null;

    if (pid && (this.state === 'awake' || this.state === 'waking')) {
      try {
        if (this.deps.queryMetrics) {
          const res = await this.deps.queryMetrics(pid);
          ramWorkingSetMb = res.ramWorkingSetMb;
          if (typeof res.cpuPercent === 'number') cpuPercent = res.cpuPercent;
          gpuPercent = res.gpuPercent ?? null;
          vramUsedMb = res.vramUsedMb ?? null;
          vramTotalMb = res.vramTotalMb ?? null;
          temperatureC = res.temperatureC ?? null;
          gpuDeviceName = res.gpuDeviceName ?? null;
        } else {
          const memRes = await this.defaultQueryMetrics(pid);
          ramWorkingSetMb = memRes.ramWorkingSetMb;
          const gpuRes = await this.queryGpuMetrics();
          gpuPercent = gpuRes.gpuPercent;
          vramUsedMb = gpuRes.vramUsedMb;
          vramTotalMb = gpuRes.vramTotalMb;
          temperatureC = gpuRes.temperatureC;
          gpuDeviceName = gpuRes.gpuDeviceName;
        }
      } catch {
        // ignore
      }
    }

    const uptimeSeconds = this.startTime ? Math.max(0, Math.floor((Date.now() - this.startTime) / 1000)) : 0;

    return {
      pid,
      state: this.state,
      ramWorkingSetMb,
      cpuPercent,
      gpuPercent,
      vramUsedMb,
      vramTotalMb,
      temperatureC,
      gpuDeviceName,
      uptimeSeconds,
      port: this.activePort,
      contextSize: this.currentHardware.contextSize,
      fitTargetMb: this.currentHardware.fitTargetMb,
    };
  }

  private calculateCpuPercent(): number {
    try {
      const cpus = os.cpus();
      let idle = 0;
      let total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          total += (cpu.times as Record<string, number>)[type];
        }
        idle += cpu.times.idle;
      }
      if (!this.lastCpuSample) {
        this.lastCpuSample = { idle, total };
        return 0;
      }
      const deltaIdle = idle - this.lastCpuSample.idle;
      const deltaTotal = total - this.lastCpuSample.total;
      this.lastCpuSample = { idle, total };
      if (deltaTotal <= 0) return 0;
      const percent = Math.round((1 - deltaIdle / deltaTotal) * 100);
      return Math.max(0, Math.min(100, percent));
    } catch {
      return 0;
    }
  }

  private queryGpuMetrics(): Promise<{
    gpuPercent: number | null;
    vramUsedMb: number | null;
    vramTotalMb: number | null;
    temperatureC: number | null;
    gpuDeviceName: string | null;
  }> {
    if (this.lastGpuMetrics && Date.now() - this.lastGpuMetrics.timestamp < 1500) {
      return Promise.resolve(this.lastGpuMetrics);
    }

    return new Promise((resolve) => {
      defaultExec(
        'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,name --format=csv,noheader,nounits',
        (err, stdout) => {
          if (err || !stdout) {
            resolve({
              gpuPercent: null,
              vramUsedMb: null,
              vramTotalMb: null,
              temperatureC: null,
              gpuDeviceName: null,
            });
            return;
          }
          try {
            const lines = stdout.trim().split('\n');
            const parts = lines[0].split(',').map((s) => s.trim());
            const gpuPercent = !isNaN(parseInt(parts[0], 10)) ? parseInt(parts[0], 10) : null;
            const vramUsedMb = !isNaN(parseInt(parts[1], 10)) ? parseInt(parts[1], 10) : null;
            const vramTotalMb = !isNaN(parseInt(parts[2], 10)) ? parseInt(parts[2], 10) : null;
            const temperatureC = !isNaN(parseInt(parts[3], 10)) ? parseInt(parts[3], 10) : null;
            const gpuDeviceName = parts[4] || null;

            const res = {
              gpuPercent,
              vramUsedMb,
              vramTotalMb,
              temperatureC,
              gpuDeviceName,
              timestamp: Date.now(),
            };
            this.lastGpuMetrics = res;
            resolve(res);
          } catch {
            resolve({
              gpuPercent: null,
              vramUsedMb: null,
              vramTotalMb: null,
              temperatureC: null,
              gpuDeviceName: null,
            });
          }
        }
      );
    });
  }

  private defaultQueryMetrics(pid: number): Promise<{ ramWorkingSetMb: number; cpuPercent: number }> {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        defaultExec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, stdout) => {
          if (err || !stdout) {
            resolve({ ramWorkingSetMb: 0, cpuPercent: 0 });
            return;
          }
          // CSV output format e.g. "llama-server.exe","14820","Console","1","5,840,112 K"
          const match = stdout.match(/"([^"]+)"\s*$/) || stdout.match(/([0-9,]+)\s*K/i);
          if (match && match[1]) {
            const kb = parseInt(match[1].replace(/,/g, ''), 10);
            if (!isNaN(kb)) {
              resolve({
                ramWorkingSetMb: Math.round((kb / 1024) * 10) / 10,
                cpuPercent: 0,
              });
              return;
            }
          }
          resolve({ ramWorkingSetMb: 0, cpuPercent: 0 });
        });
      } else {
        resolve({ ramWorkingSetMb: 0, cpuPercent: 0 });
      }
    });
  }

  private async waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.state === 'error' || !this.childProcess) {
        return false;
      }
      const ok = await this.deps.probeHealth(port);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 600));
    }
    return false;
  }

  private defaultProbeHealth(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/health',
          timeout: 1000,
        },
        (res: http.IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.status === 'ok');
            } catch {
              resolve(res.statusCode === 200);
            }
          });
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private defaultKillProcessTree(pid: number | null, modelPath?: string): Promise<void> {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        if (pid) {
          defaultExec(`taskkill /PID ${pid} /T /F`, () => {
            resolve();
          });
        } else if (modelPath) {
          // Fallback cleanup by model name if pid was lost
          const baseModel = modelPath.split(/[/\\]/).pop() || '';
          defaultExec(
            `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${baseModel}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
            () => resolve()
          );
        } else {
          resolve();
        }
      } else {
        if (pid) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            try {
              process.kill(pid, 'SIGKILL');
            } catch {
              // ignore
            }
          }
        }
        resolve();
      }
    });
  }
}

export function createQwenMiddleware(
  controller: QwenProcessController
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const rawReq = req as unknown as http.IncomingMessage;
    const rawRes = res as unknown as http.ServerResponse;
    const url = rawReq.url || '';

    // Handle Control APIs
    if (url.startsWith('/api/qwen/control/')) {
      const endpoint = url.split('?')[0];

      if (rawReq.method === 'GET' && endpoint === '/api/qwen/control/status') {
        rawRes.setHeader('Content-Type', 'application/json');
        rawRes.end(JSON.stringify(controller.getStatus()));
        return;
      }

      if (rawReq.method === 'GET' && endpoint === '/api/qwen/control/metrics') {
        rawRes.setHeader('Content-Type', 'application/json');
        controller
          .getMetrics()
          .then((metrics) => {
            rawRes.end(JSON.stringify(metrics));
          })
          .catch((err) => {
            rawRes.statusCode = 500;
            rawRes.end(JSON.stringify({ error: (err as Error).message }));
          });
        return;
      }

      if (rawReq.method === 'POST') {
        let body = '';
        rawReq.on('data', (chunk: Buffer | string) => (body += chunk));
        rawReq.on('end', async () => {
          let payload: Record<string, unknown> = {};
          try {
            if (body) payload = JSON.parse(body);
          } catch {
            // ignore
          }

          try {
            if (endpoint === '/api/qwen/control/start') {
              const status = await controller.start(payload.hardware as QwenHardwareSettings);
              rawRes.setHeader('Content-Type', 'application/json');
              rawRes.end(JSON.stringify(status));
              return;
            }

            if (endpoint === '/api/qwen/control/stop') {
              const status = await controller.stop();
              rawRes.setHeader('Content-Type', 'application/json');
              rawRes.end(JSON.stringify(status));
              return;
            }

            if (endpoint === '/api/qwen/control/restart') {
              const status = await controller.restart(payload.hardware as QwenHardwareSettings);
              rawRes.setHeader('Content-Type', 'application/json');
              rawRes.end(JSON.stringify(status));
              return;
            }
          } catch (err) {
            rawRes.statusCode = 500;
            rawRes.setHeader('Content-Type', 'application/json');
            rawRes.end(JSON.stringify({ error: (err as Error).message }));
            return;
          }

          rawRes.statusCode = 404;
          rawRes.end(JSON.stringify({ error: 'Unknown control action' }));
        });
        return;
      }
    }

    // Handle Proxy to llama-server
    if (url.startsWith('/api/qwen/v1/')) {
      const targetPath = url.replace(/^\/api\/qwen/, '');
      const status = controller.getStatus();

      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: status.port,
          path: targetPath,
          method: rawReq.method,
          headers: {
            ...rawReq.headers,
            host: `127.0.0.1:${status.port}`,
          },
        },
        (proxyRes: http.IncomingMessage) => {
          rawRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(rawRes);
        }
      );

      proxyReq.on('error', (err: Error) => {
        if (!rawRes.headersSent) {
          rawRes.statusCode = 502;
          rawRes.setHeader('Content-Type', 'application/json');
          rawRes.end(
            JSON.stringify({
              error: `Failed to connect to local Qwen server at 127.0.0.1:${status.port}: ${err.message}`,
            })
          );
        }
      });

      rawReq.pipe(proxyReq);
      return;
    }

    next();
  };
}

export function qwenProcessControllerPlugin(): Plugin {
  const controller = new QwenProcessController();

  return {
    name: 'krakinai-qwen-process-controller',
    configureServer(server) {
      server.middlewares.use(createQwenMiddleware(controller));
    },
    closeBundle() {
      void controller.stop();
    },
  };
}
