// Creates reviewable instructions and an ignored driver copy. No certificates,
// trust stores, signing operations, private keys or execution-policy changes.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const directory = resolve('qa-results/local-mcp/signing',randomUUID()); await mkdir(directory,{recursive:true});
const helper=resolve('bridge/dist/native/verify.ps1'), driver=resolve(directory,'mcp-native-window.ps1');
await copyFile(resolve('scripts/qa/mcp-native-window.ps1'),driver);
const files = await Promise.all([helper,driver].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
const quote=value=>`'${value.replaceAll("'","''")}'`;
const commands=`# Review these unsigned hashes and source before running any trust/signing command.
${files.map(f=>`# ${f.sha256}  ${f.path}`).join('\n')}
$qaThumbprint = 'PASTE YOUR CHOSEN CERTIFICATE THUMBPRINT HERE'
if ($qaThumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Use only the chosen public certificate thumbprint.' }
${files.map(f=>`if ((Get-FileHash -LiteralPath ${quote(f.path)} -Algorithm SHA256).Hash -ne ${quote(f.sha256)}) { throw 'The reviewed unsigned file changed. Stop and review it again.' }`).join('\n')}
$qaSigner = Get-Item -LiteralPath ("Cert:\\CurrentUser\\My\\" + $qaThumbprint) -ErrorAction Stop
if (-not $qaSigner.HasPrivateKey) { throw 'The selected certificate has no local private key.' }
$qaPublicCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($qaSigner.RawData)
foreach ($qaStoreName in @('Root','TrustedPublisher')) {
  $qaStore = [Security.Cryptography.X509Certificates.X509Store]::new($qaStoreName,'CurrentUser')
  try { $qaStore.Open('ReadWrite'); $qaStore.Add($qaPublicCertificate) } finally { $qaStore.Close() }
}
${files.map(f=>`Set-AuthenticodeSignature -LiteralPath ${quote(f.path)} -Certificate $qaSigner -HashAlgorithm SHA256 | Select-Object Path,Status,StatusMessage`).join('\n')}
${files.map(f=>`$qaSignature = Get-AuthenticodeSignature -LiteralPath ${quote(f.path)}; $qaSignature | Select-Object Path,Status,StatusMessage; if ($qaSignature.Status -ne 'Valid') { throw 'Signature is not valid. Keep the native gate blocked.' }`).join('\n')}
$env:KRAKINAI_NATIVE_QA = '1'
$env:KRAKINAI_NATIVE_QA_DRIVER = ${quote(driver)}
npx playwright test e2e/local-mcp-native.spec.mjs
`;
await writeFile(resolve(directory,'review.json'),JSON.stringify({files,executionPolicy:'preserve AllSigned',automaticSecurityChanges:false},null,2));
await writeFile(resolve(directory,'commands.txt'),commands); console.log(commands); console.log(`Instructions retained at ${directory}`);
