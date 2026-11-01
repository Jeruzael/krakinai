import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--outdir' || !args[1])) throw Error('BUILD_OPTIONS_REJECTED');
const outdir = resolve(args[1] ?? 'dist');
const entryPoints = { protocol: '../src/domain/mcpProtocol.ts', crypto: '../src/domain/mcpCrypto.ts' };
if (existsSync('src/server.ts')) entryPoints['krakinai-mcp'] = 'src/server.ts';
if (existsSync('src/managedHostEntry.ts')) entryPoints['krakinai-managed-host'] = 'src/managedHostEntry.ts';
if (existsSync('src/stdioAdapterEntry.ts')) entryPoints['krakinai-stdio-adapter'] = 'src/stdioAdapterEntry.ts';
await build({ entryPoints, outdir, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external', sourcemap: false });
if (existsSync('native/verify.ps1')) { await mkdir(resolve(outdir, 'native'), { recursive: true }); await copyFile('native/verify.ps1', resolve(outdir, 'native/verify.ps1')); }
