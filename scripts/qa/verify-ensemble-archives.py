"""Independent readback of the small, generated B2 browser fixtures; no extraction.

Run after the full browser suite: python scripts/qa/verify-ensemble-archives.py
This is not a large-library restore or ZIP64 certification tool.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(stream):
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


root = Path(sys.argv[1] if len(sys.argv) > 1 else "qa-results/ensemble-b2").resolve()
result = json.loads((root / "backup-restart-project-export.json").read_text(encoding="utf-8"))
reference = json.loads((root / "reference-associations.json").read_text(encoding="utf-8"))
checks = []
for kind, path, expected in [
    ("full", result["archivePath"], result["archiveSha256"]),
    ("project", result["projectPath"], result["projectSha256"]),
    ("references", reference["path"], reference["archiveSha256"]),
]:
    archive = Path(path).resolve()
    archive.relative_to(root)  # Never follow a report outside the synthetic fixture directory.
    require(archive.is_file(), f"Missing {kind} fixture")
    require(archive.stat().st_size <= 8 * 1024 * 1024, "Small synthetic fixtures only (8 MiB cap)")
    with archive.open("rb") as stream:
        require(sha256(stream) == expected, f"{kind} archive SHA-256 mismatch")
    with zipfile.ZipFile(archive) as source:
        require(len(source.infolist()) <= 32, "Small fixture entry limit exceeded")
        require(sum(i.file_size for i in source.infolist()) <= 16 * 1024 * 1024, "Small fixture uncompressed limit exceeded")
        require(source.testzip() is None, f"{kind} CRC failure")
        details = dict(kind=kind, path=str(archive), bytes=archive.stat().st_size,
                       sha256=expected, entries=len(source.infolist()),
                       uncompressedBytes=sum(i.file_size for i in source.infolist()), crc="passed")
        if kind == "full":
            manifest = json.loads(source.read("manifest.json"))
            for original in result["mediaHashes"]:
                matches = [n for n in source.namelist() if n.startswith("media/" + original["id"] + ".")]
                require(len(matches) == 1, "Full backup media entry not unique")
                with source.open(matches[0]) as stream:
                    require(sha256(stream) == original["sha256"], "Full media SHA-256 mismatch")
            details.update(sourceMediaHashesMatched=len(result["mediaHashes"]),
                           **{key: len(manifest[key]) for key in ("scenes", "assets", "variants", "templates")})
        if kind == "project":
            for original in result["projectBinaryHashes"]:
                with source.open(original["path"]) as stream:
                    require(sha256(stream) == original["sha256"], "Project binary SHA-256 mismatch")
            groups = {}
            for association in result["projectAssociations"]:
                groups.setdefault(association["mediaId"], set()).add(association["archivePath"])
            require(all(len(paths) == 1 for paths in groups.values()), "Duplicate project media paths")
            details.update(binaryHashesMatched=len(result["projectBinaryHashes"]),
                           associationCount=len(result["projectAssociations"]), uniqueMedia=len(groups))
        if kind == "references":
            manifest = json.loads(source.read("manifest.json"))
            wardrobe = [e for e in manifest["entries"] if e["sourceSlot"] == "wardrobe"]
            require(len(manifest["entries"]) == 5, "Expected five selected associations")
            require(sorted(e["participantId"] for e in wardrobe) == ["lucas", "primary"], "Wardrobe provenance mismatch")
            require(len({e["binaryPath"] for e in wardrobe}) == 1, "Shared wardrobe bytes duplicated")
            require(len([n for n in source.namelist() if n.startswith("media/")]) == 3, "Expected three binaries")
            details.update(associations=5, binaries=3, participantIds=["primary", "lucas"])
        checks.append(details)
report = dict(reader="Python zipfile", checks=checks,
              fixtureNote="New canvas PNGs and corrected unit PNG are browser-decoded; two inherited PNG-labelled byte fixtures remain opaque and byte-identical. Small fixtures only; no large-capacity certification.")
(root / "python-readback.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(dict(archives=len(checks), crc="passed", fullSourceHashes=checks[0]["sourceMediaHashesMatched"],
                      projectBinaryHashes=checks[1]["binaryHashesMatched"])))
