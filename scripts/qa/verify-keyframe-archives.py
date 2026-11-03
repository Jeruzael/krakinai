"""Read-only independent ZIP/CRC, SHA-256 and exact prompt verification for synthetic C QA."""
import hashlib
import json
import pathlib
import sys
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(directory):
    directory = pathlib.Path(directory).resolve()
    expected = json.loads((directory / "expectations.json").read_text(encoding="utf-8"))
    assert expected["syntheticOnly"] is True
    results = []
    for filename, source in expected["archives"].items():
        path = directory / filename
        assert path.parent == directory and sha(path.read_bytes()) == source["sha256"]
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            assert len(entries) <= 2000 and len({i.filename for i in entries}) == len(entries)
            assert all(".." not in pathlib.PurePosixPath(i.filename).parts and not i.filename.startswith("/") and "\\" not in i.filename for i in entries)
            assert archive.testzip() is None
            manifest_name = next(i.filename for i in entries if i.filename.endswith("manifest.json"))
            manifest = json.loads(archive.read(manifest_name))
            if "records" in source:
                assert manifest["schemaVersion"] == 2 and "keyframes.v1" in manifest["requiredFeatures"]
                for field in ("assets", "variants", "drafts", "scenes", "collections", "templates"):
                    assert manifest[field] == source["records"][field], field
                assert manifest["preferences"] == source["records"]["preferences"][0]
                originals = {m["id"]: m for m in source["records"]["media"]}
                for media in manifest["media"]:
                    actual = sha(archive.read(media["archivePath"]))
                    assert actual == media["sha256"] == originals[media["id"]]["sha256"]
                    if media.get("posterArchivePath"):
                        assert sha(archive.read(media["posterArchivePath"])) == media["posterSha256"] == originals[media["id"]]["posterSha256"]
            elif manifest.get("schema") == "krakinai.flow-handoff.v1":
                assert manifest == source["manifest"]
                assert len(manifest["files"]) == len(source["originalHashes"])
                assert [entry["sha256"] for entry in manifest["files"]] == source["originalHashes"]
                for entry in manifest["files"] + manifest["textFiles"]:
                    data = archive.read(entry["path"])
                    assert sha(data) == entry["sha256"] and len(data) == entry["byteSize"]
                for text_path, text in source["texts"].items():
                    assert archive.read(text_path) == text.encode("utf-8")
                for association in manifest["associations"]:
                    if not association["excluded"]:
                        assert not association["missing"]
                        assert sha(archive.read(association["path"])) == association["sha256"]
            else:
                assert manifest == source["manifest"] and manifest["schema"] == "krakinai.project-export.v3"
                for association in manifest["associations"]:
                    if not association["excluded"]:
                        assert sha(archive.read(association["archivePath"])) == association["sha256"]
                for shot in manifest["shots"]:
                    take = shot.get("selectedTake") or {}
                    for frame_id, paths in shot.get("imageFrameFiles", {}).items():
                        document = json.loads(archive.read(paths["document"]))
                        assert document["keyframeId"] == frame_id and document["sceneId"] == take["id"]
                        for mode in ("full", "compact"):
                            if mode in paths:
                                manual = take.get("manualImageOutputs", {}).get(frame_id, {}).get(mode)
                                text = manual["text"] if manual else take["imagePromptSnapshots"][frame_id][mode]
                                assert archive.read(paths[mode]) == text.encode("utf-8")
            results.append({"file": str(path), "sha256": source["sha256"], "entries": len(entries), "compressedBytes": path.stat().st_size, "uncompressedBytes": sum(i.file_size for i in entries), "verified": True})
    return {"syntheticOnly": True, "success": True, "archives": results}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/qa/verify-keyframe-archives.py SYNTHETIC_ARCHIVE_DIRECTORY")
    print(json.dumps(verify(sys.argv[1]), indent=2))
