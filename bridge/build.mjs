import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
const entryPoints = { protocol: '../src/domain/mcpProtocol.ts', crypto: '../src/domain/mcpCrypto.ts' };
if (existsSync('src/server.ts')) entryPoints['krakinai-mcp'] = 'src/server.ts';
await build({ entryPoints, outdir: 'dist', outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external', sourcemap: false });
if (existsSync('native/verify.ps1')) { await mkdir('dist/native', { recursive: true }); await copyFile('native/verify.ps1', 'dist/native/verify.ps1'); }
