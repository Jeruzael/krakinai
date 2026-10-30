// Test entry points are never included in production dist or user setup commands.
import { build } from 'esbuild';
await build({ entryPoints: ['test/browser-server.ts'], outdir: 'qa-results/synthetic-runtime', outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external' });
