"""Read every original member with Python, verify source hashes, write a legacy v1 fixture."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile

archive = Path(sys.argv[1]); expected = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
entries = []
with archive.open('rb') as raw, zipfile.ZipFile(archive) as backup:
    manifest = json.loads(backup.read('manifest.json'))
    by_id = {media['id']: media for media in expected['media']}
    for item in backup.infolist():
        digest = hashlib.sha256(); size = 0
        with backup.open(item) as stream:
            while True:
                chunk = stream.read(256 * 1024)
                if not chunk: break
                digest.update(chunk); size += len(chunk)
        raw.seek(item.header_offset); header = raw.read(30); name, extra = struct.unpack_from('<HH', header, 26)
        entries.append({'path': item.filename, 'bytes': size, 'sha256': digest.hexdigest(), 'crc32': item.CRC, 'dataOffset': item.header_offset + 30 + name + extra})
    by_path = {entry['path']: entry for entry in entries}
    for media in manifest['media']:
        assert by_path[media['archivePath']]['sha256'] == by_id[media['id']]['sha256']
        assert media['byteSize'] == by_path[media['archivePath']]['bytes']
    for name in ['assets', 'variants', 'drafts', 'scenes', 'collections', 'templates', 'media']:
        assert len(manifest[name]) == expected['counts'][name]
    with zipfile.ZipFile(archive.with_name('legacy-backup.zip'), 'x', compression=zipfile.ZIP_STORED, allowZip64=True) as legacy:
        for media in manifest['media']:
            media.pop('sha256', None); media.pop('posterSha256', None)
        for item in backup.infolist():
            if item.filename == 'manifest.json': legacy.writestr('manifest.json', json.dumps(manifest).encode('utf-8'))
            else:
                with backup.open(item) as source, legacy.open(item.filename, 'w', force_zip64=True) as target:
                    while True:
                        chunk = source.read(256 * 1024)
                        if not chunk: break
                        target.write(chunk)
result = {'pythonVersion': sys.version, 'compressedBytes': archive.stat().st_size, 'archiveSha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest(), 'counts': expected['counts'], 'allSourceMediaHashesMatch': True, 'entries': entries, 'legacyBytes': archive.with_name('legacy-backup.zip').stat().st_size}
archive.with_name('python-inspection.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'entries'}))
