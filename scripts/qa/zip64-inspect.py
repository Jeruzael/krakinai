"""Independent, bounded zipfile CRC/size/SHA-256 inspection of synthetic stress ZIPs."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import time
import zipfile

archive = Path(sys.argv[1])
expected_path = Path(sys.argv[2])
expected = json.loads(expected_path.read_text(encoding='utf-8'))
started = time.monotonic()
actual = []
with zipfile.ZipFile(archive) as backup:
    names = [item.filename for item in backup.infolist()]
    expected_names = expected['expectedPaths']
    assert len(names) == expected['entryCount'], (len(names), expected['entryCount'])
    assert len(set(names)) == len(names), 'Duplicate ZIP member names'
    assert names == expected_names, 'ZIP member order/path set differs from source manifest'
    for item in backup.infolist():
        digest = hashlib.sha256()
        size = 0
        with backup.open(item) as source:
            while True:
                chunk = source.read(256 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
                size += len(chunk)
        assert size == item.file_size, item.filename
        assert size == expected['expectedEntrySizes'][item.filename], item.filename
        assert digest.hexdigest() == expected['expectedHashes'][item.filename], item.filename
        actual.append({'path': item.filename, 'size': size, 'compressedBytes': item.compress_size, 'sha256': digest.hexdigest(), 'crc32': item.CRC, 'headerOffset': item.header_offset, 'zipVersion': item.extract_version})
with archive.open('rb') as source:
    source.seek(max(0, archive.stat().st_size - 65557 - 76))
    tail = source.read(65557 + 76)
report = {'pythonVersion': sys.version, 'compressedBytes': archive.stat().st_size, 'uncompressedBytes': sum(item['size'] for item in actual), 'entryCount': len(actual), 'zip64EndMarker': b'PK\x06\x06' in tail, 'zip64Locator': b'PK\x06\x07' in tail, 'offsetBeyond32Bit': any(item['headerOffset'] > 0xffffffff for item in actual), 'crcAndSha256Pass': True, 'elapsedSeconds': round(time.monotonic() - started, 3), 'entries': actual}
assert report['compressedBytes'] == expected['compressedBytes']
assert report['uncompressedBytes'] == expected['uncompressedBytes']
assert report['zip64EndMarker'] and report['zip64Locator'], 'ZIP64 end records missing'
if expected['requestedMiB'] >= 4300:
    assert report['offsetBeyond32Bit'], 'No member offset crossed the 32-bit ZIP boundary'
if expected['requestedMiB'] == 5500:
    assert report['compressedBytes'] == 5500 * 1024 * 1024, 'Compressed boundary is not exactly 5500 MiB'
expected_path.with_name('python-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'entries'}, indent=2))
