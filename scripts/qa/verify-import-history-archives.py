"""Independent stdlib readback of the four synthetic import-history ZIP fixtures."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import zipfile
import zlib

MIB = 1024 * 1024
EXPECTED = {"bulk.zip", "stored-8MiB.zip", "expanded-32MiB.zip", "high-entropy-4MiB.zip"}


def check_archive(path):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "ZIP CRC readback failed"
        info = archive.getinfo("manifest.json")
        assert info.file_size <= 20 * MIB, "Manifest limit changed/exceeded"
        manifest = json.loads(archive.read(info))
        assert "compact-import-evidence.v1" in manifest["requiredFeatures"]
        ledger = manifest["preferences"]["aiImports"]
        assert ledger["version"] == 4
        stored = len(json.dumps(ledger, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        assert stored <= 8 * MIB
        expanded = 0
        evidence_hashes = []
        frame_results = 0
        for receipt in ledger["receipts"]:
            if receipt["version"] == 4:
                envelope = receipt["reviewedEvidence"]
                assert envelope["encoding"] == "deflate-utf8-base64.v1"
                raw = base64.b64decode(envelope["data"], validate=True)
                assert base64.b64encode(raw).decode("ascii") == envelope["data"]
                decoder = zlib.decompressobj()
                plain = decoder.decompress(raw, 4 * MIB + 1)
                assert len(plain) <= 4 * MIB and not decoder.unconsumed_tail
                assert decoder.eof and not decoder.unused_data, "Truncated/trailing compressed evidence"
                assert len(plain) == envelope["uncompressedBytes"]
                digest = hashlib.sha256(plain).hexdigest()
                assert digest == envelope["sha256"]
                json.loads(plain.decode("utf-8"))
            elif receipt["version"] in (2, 3):
                plain = receipt["reviewedContent"].encode("utf-8")
                assert len(plain) <= 4 * MIB
                json.loads(plain)
                digest = hashlib.sha256(plain).hexdigest()
            else:
                assert receipt["version"] == 1
                continue
            expanded += len(plain)
            evidence_hashes.append({"changeSetId": receipt["changeSetId"], "sha256": digest, "bytes": len(plain)})
            frame_results += sum(len(row["frameIds"]) for row in receipt.get("frameResults", []))
        assert expanded <= 32 * MIB
        media_hashes = []
        for media in manifest["media"]:
            digest = hashlib.sha256(archive.read(media["archivePath"])).hexdigest()
            assert digest == media["sha256"]
            if media.get("posterArchivePath"):
                assert hashlib.sha256(archive.read(media["posterArchivePath"])).hexdigest() == media["posterSha256"]
            media_hashes.append({"id": media["id"], "sha256": digest, "mimeType": media["mimeType"], "bytes": media["byteSize"]})
        if path.name == "bulk.zip":
            assert frame_results == 33
        if path.name == "stored-8MiB.zip":
            assert stored == 8 * MIB
        if path.name == "expanded-32MiB.zip":
            assert expanded == 32 * MIB
        if path.name == "high-entropy-4MiB.zip":
            assert expanded == 4 * MIB and stored > 4 * MIB
        return {"file": path.name, "archiveBytes": path.stat().st_size,
                "archiveSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "manifestBytes": info.file_size, "storedLedgerBytes": stored,
                "expandedEvidenceBytes": expanded, "receipts": len(ledger["receipts"]),
                "frameResults": frame_results, "mediaHashes": media_hashes,
                "evidenceHashes": evidence_hashes, "zipCrcVerified": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    assert args.directory.is_dir()
    assert EXPECTED <= {p.name for p in args.directory.glob("*.zip")}, "Missing synthetic archive case"
    results = [check_archive(args.directory / name) for name in sorted(EXPECTED)]
    output = {"reader": "Python zipfile/zlib/hashlib (independent of fflate)", "passed": len(results), "archives": results}
    (args.directory / "independent-readback.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": len(results), "archives": [{"file": r["file"], "storedLedgerBytes": r["storedLedgerBytes"], "expandedEvidenceBytes": r["expandedEvidenceBytes"], "archiveSha256": r["archiveSha256"]} for r in results]}))


if __name__ == "__main__":
    main()
