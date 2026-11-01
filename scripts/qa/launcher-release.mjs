// Build a NEW local release candidate and review instructions. Never signs or changes trust.
import { mkdir, readFile, writeFile, copyFile, readdir, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function sameHelperBody(source, signed) {
  const body = text => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('# SIG # Begin signature block')[0].trimEnd();
  return body(source) === body(signed);
}
export function assertReleaseDestination(root, output) {
  const child = relative(resolve(root, 'qa-results/desktop-bridge-launcher/releases'), resolve(output));
  if (!child || child.startsWith('..') || isAbsolute(child) || existsSync(output)) throw Error('RELEASE_DESTINATION_REJECTED');
}
export async function inventory(directory, base = directory) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), info = await lstat(path);
    if (info.isSymbolicLink()) throw Error('RELEASE_SYMLINK_REJECTED');
    if (info.isDirectory()) files.push(...await inventory(path, base));
    else if (info.isFile()) files.push({ path: relative(base, path).replaceAll('\\', '/'), bytes: info.size, sha256: hash(await readFile(path)) });
  }
  return files;
}
async function command(executable, args, cwd, env = process.env) {
  const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = ''; const collect = bytes => { text += String(bytes); if (text.length > 524288) child.kill(); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const code = await new Promise((yes, no) => { child.on('error', no); child.once('exit', yes); });
  if (code !== 0) throw Error('RELEASE_COMMAND_FAILED: ' + text.slice(-6000)); return text;
}
async function main() {
  if (process.platform !== 'win32') throw Error('WINDOWS_RELEASE_ONLY');
  const args = process.argv.slice(2);
  if (args.length !== 6 || args[0] !== '--output' || args[2] !== '--signed-helper' || args[4] !== '--signer' || !/^[A-Fa-f0-9]{40}$/.test(args[5])) throw Error('RELEASE_OPTIONS_REJECTED');
  const root = resolve('.'), output = resolve(args[1]), helper = resolve(args[3]), signer = args[5].toUpperCase();
  assertReleaseDestination(root, output);
  if (!sameHelperBody(await readFile(join(root, 'bridge/native/verify.ps1'), 'utf8'), await readFile(helper, 'utf8'))) throw Error('SIGNED_HELPER_BODY_MISMATCH');
  const powershell = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const probeEnvironment = Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const helperStatus = JSON.parse(await command(powershell, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath $env:KRAKINAI_RELEASE_HELPER; @{status=[string]$s.Status;signer=[string]$s.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress"], root, { ...probeEnvironment, KRAKINAI_RELEASE_HELPER: helper }));
  if (helperStatus.status !== 'Valid' || helperStatus.signer !== signer) throw Error('SIGNED_HELPER_NOT_VALID');
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const env = { ...process.env, DOTNET_CLI_HOME: join(root, 'qa-results/desktop-bridge-launcher/dotnet-home'), DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false', DOTNET_ADD_GLOBAL_TOOLS_TO_PATH: 'false', DOTNET_NOLOGO: 'true' };
  console.log('RELEASE_BUILD_NATIVE');
  const nativeLog = await command(join(process.env.ProgramFiles, 'dotnet/dotnet.exe'), ['publish', 'launcher/Krakinai.BridgeLauncher.csproj', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'false', '-p:PublishSingleFile=true', '-p:DebugType=None', '-p:DebugSymbols=false', '-o', output], root, env);
  await writeFile(join(output, 'native-build.log'), nativeLog);
  console.log('RELEASE_BUILD_BRIDGE');
  const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), bridge = join(output, 'bridge');
  await command(process.execPath, [npm, '--prefix', 'bridge', 'run', 'build', '--', '--outdir', bridge], root);
  for (const name of ['package.json', 'package-lock.json']) await copyFile(join(root, 'bridge', name), join(bridge, name));
  await command(process.execPath, [npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-fund', '--no-audit'], bridge);
  await copyFile(helper, join(bridge, 'native/verify.ps1'));
  const audit = await command(process.execPath, [npm, 'audit', '--omit=dev', '--json'], bridge); await writeFile(join(output, 'production-audit.json'), audit);
  const files = await inventory(output), executable = join(output, 'Krakinai.BridgeLauncher.exe'), unsigned = files.find(file => file.path === 'Krakinai.BridgeLauncher.exe');
  if (!unsigned || files.some(file => /\.(pfx|p12|cer|crt|key)$/i.test(file.path))) throw Error('RELEASE_CONTENT_REJECTED');
  const sourceFiles = [...await inventory(join(root, 'launcher'))].filter(file => !/^(?:Core\/|tests\/)?(?:bin|obj)\//.test(file.path));
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const signing = `# Review the candidate and source first. Sign ONLY this executable; no trust/policy changes.\n$krakinaiExecutable = ${quote(executable)}\nif ((Get-FileHash -LiteralPath $krakinaiExecutable -Algorithm SHA256).Hash -ne ${quote(unsigned.sha256.toUpperCase())}) { throw 'Reviewed executable changed. Stop and review again.' }\n$krakinaiCertificate = Get-Item -LiteralPath ${quote('Cert:\\CurrentUser\\My\\' + signer)} -ErrorAction Stop\nif (-not $krakinaiCertificate.HasPrivateKey) { throw 'No local private key for the selected signer.' }\nSet-AuthenticodeSignature -LiteralPath $krakinaiExecutable -Certificate $krakinaiCertificate -HashAlgorithm SHA256 | Select-Object Path, Status, StatusMessage\n$krakinaiSignature = Get-AuthenticodeSignature -LiteralPath $krakinaiExecutable\nif ($krakinaiSignature.Status -ne 'Valid' -or $krakinaiSignature.SignerCertificate.Thumbprint -ne ${quote(signer)}) { throw 'Signature verification failed. Do not run the release.' }\n$krakinaiSignature | Select-Object Path, Status, StatusMessage\n`;
  await writeFile(join(output, 'signing-commands.txt'), signing);
  await writeFile(join(output, 'release-review.json'), JSON.stringify({ status: 'unsigned-candidate', signedNativeAcceptance: false, output, signer, unsignedExecutableSha256: unsigned.sha256, signedHelperSha256: hash(await readFile(helper)), helperBodyMatchesSource: true, files, nativeSourceDigest: hash(JSON.stringify(sourceFiles)), noAutomaticSigning: true, noTrustOrPolicyChanges: true }, null, 2));
  console.log(JSON.stringify({ output, executable, unsignedExecutableSha256: unsigned.sha256, files: files.length, totalBytes: files.reduce((n, file) => n + file.bytes, 0), signingCommands: join(output, 'signing-commands.txt') }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
