"""Read synthetic browser ZIP artifacts independently, without extraction or writes to browser data."""
import hashlib
import json
import struct
import zipfile
from pathlib import Path

root = Path("qa-results/shot-types")
fixture = json.loads((root / "midori-integrity.json").read_text(encoding="utf-8"))["fixture"]
expected = fixture["originalSha256"]
results = []
for name in ["midori-reference.zip", "midori-project.zip", "midori-full-backup.zip"]:
    path = root / name
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, name
        originals = []
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            data = archive.read(entry)
            if hashlib.sha256(data).hexdigest() == expected:
                assert data[:8] == b"\x89PNG\r\n\x1a\n"
                assert struct.unpack(">II", data[16:24]) == (960, 720)
                assert len(data) == fixture["originalByteSize"]
                originals.append(entry.filename)
        assert len(originals) == 1, (name, originals)
        manifest_path = next(n for n in archive.namelist() if n.endswith("manifest.json"))
        manifest = json.loads(archive.read(manifest_path))
        if name == "midori-reference.zip":
            assert any(e["sourceSlot"] == "source" and e["mediaId"] == fixture["sourceId"]
                       and e["filename"] == fixture["originalFilename"] for e in manifest["entries"])
        elif name == "midori-project.zip":
            take = next(s["selectedTake"] for s in manifest["shots"] if s["id"] == fixture["shotId"])
            assert take["shotType"] == "graphic_motion"
            assert take["sourceMediaLinks"][0]["mediaId"] == fixture["sourceId"]
        else:
            assert any(s.get("shotType") == "graphic_motion" and
                       s["sourceMediaLinks"][0]["mediaId"] == fixture["sourceId"] for s in manifest["scenes"])
        results.append({"path": path.as_posix(), "archiveBytes": path.stat().st_size,
                        "archiveSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "entries": len(archive.infolist()), "sourcePaths": originals,
                        "sourceSha256": expected, "originalBytes": fixture["originalByteSize"],
                        "crcReadbackPassed": True, "pngHeaderDimensions": [960, 720],
                        "sourceMetadataVerified": True})

report = {"reader": "Python standard-library zipfile", "archives": results,
          "originalPngSha256": expected, "sourceHashMatchedAllThree": True}
(root / "independent-archive-readback.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
