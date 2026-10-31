# Local test certificate and PowerShell signing

Windows PowerShell 5.1 on the development machine requires `AllSigned`. Git's SSH signing key does not sign PowerShell files. Microsoft documents self-signed code-signing certificates for local testing: [about Signing](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_signing) and [Set-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-authenticodesignature).

These steps require the local owner's **explicit security approval**. The application never performs them. An agent must not create trust or use the signing key without that approval. On a managed PC use the administrator's approved certificate process. Do not lower execution policy, unblock files to evade it, or send a private key/passphrase in chat.

## Create the local certificate

Paste this directly into Windows PowerShell if you choose to create a local test certificate:

```powershell
New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=KRAKINAI Local Development" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy NonExportable `
  -HashAlgorithm SHA256
```

The non-exportable private key stays in your current-user Windows key store. This does not make the certificate trusted on your computer or anybody else's computer.

## Review, trust and sign only the test copies

Build the bridge **before signing**. Run `node scripts/qa/mcp-prepare-signing.mjs` from the repository root. It makes a new ignored copy of the QA driver and prints the exact two paths, unsigned SHA-256 hashes and signing commands. It does not create a certificate, touch a trust store, access a private key or execute the PowerShell files.

Review the source and the printed hashes first. The commands select the public thumbprint of your chosen certificate, add only its public certificate to your **current-user** Root and TrustedPublisher stores, and sign the compiled helper and ignored QA-driver copy. Trust applies to this publisher, not only those two files: protect its key and use it only for code you reviewed. The signature blocks/certificate are not committed to the repository.

The generated instructions preserve `AllSigned` and verify both signatures. Run the opt-in native test with the printed QA-driver path. Rebuilding `bridge/` replaces its compiled helper and requires signing that helper again. Editing either signed file invalidates its signature.

After first importing trust, an immediate verification in the same PowerShell process can still fail. Start a fresh Windows PowerShell process and verify both files again with `Get-AuthenticodeSignature`; continue only when both report `Valid`. Do not treat a signing attempt alone as successful verification. The development-machine follow-up explicitly obtained owner approval, verified both signed copies in a fresh process, and passed the three native tests without changing `AllSigned`.

If either signature remains untrusted, policy prohibits current-user trust, or no certificate is available, retain the native certification blocker and the draft PR. Portable SDK/browser tests and the installed CLI's unpaired status proof do not substitute for native pairing or paired CLI reads.
