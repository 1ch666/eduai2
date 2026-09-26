"""Read the official XLSX archive without changing it; emit whole-entry RAG records.
Usage: python scripts/import-moe-dictionary.py path/to/official.zip
Standard library only. No model calls, embeddings, paid services or database writes.
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

VERSION = '2015_20260625'
ROOT = Path(__file__).resolve().parents[1] / 'rag' / 'moe-revised'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
SOURCE = 'https://dict.revised.moe.edu.tw/'

def excel_text(value):
    # Decode OOXML escapes once (including escaped literal _xNNNN_ sequences).
    return re.sub(r'_x([0-9A-Fa-f]{4})_', lambda m: chr(int(m[1], 16)), value)

def column(ref):
    result = 0
    for char in re.match(r'[A-Z]+', ref)[0]:
        result = result * 26 + ord(char) - 64
    return result - 1

def rows(archive):
    shared = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    strings = [excel_text(''.join(t.text or '' for t in si.findall('.//s:t', NS))) for si in shared]
    with archive.open('xl/worksheets/sheet1.xml') as stream:
        for _, row in ET.iterparse(stream, events=('end',)):
            if row.tag != '{' + NS['s'] + '}row':
                continue
            values = [''] * 18
            for cell in row:
                value = cell.findtext('s:v', '', NS)
                if cell.get('t') == 's':
                    value = strings[int(value)]
                elif cell.get('t') == 'inlineStr':
                    value = excel_text(''.join(t.text or '' for t in cell.findall('.//s:t', NS)))
                values[column(cell.attrib['r'])] = value
            yield int(row.attrib['r']), values
            row.clear()

def main():
    raw = Path(sys.argv[1]).read_bytes()
    package = zipfile.ZipFile(io.BytesIO(raw))
    book = zipfile.ZipFile(io.BytesIO(package.read(f'dict_revised_{VERSION}.xlsx')))
    iterator = rows(book)
    _, headers = next(iterator)
    assert headers[0] == '字詞名' and headers[15] == '釋義', 'Unexpected official schema'
    entries = {}
    count = 0
    for row_number, values in iterator:
        if not any(values):
            continue
        word = values[0]
        assert word, f'Missing headword at row {row_number}'
        entry = entries.setdefault(word, {
            'id': 'moe-revised:' + hashlib.sha256(word.encode()).hexdigest(),
            'word': word, 'source': '中華民國教育部《重編國語辭典修訂本》',
            'source_url': SOURCE, 'version': VERSION, 'license': 'CC BY-ND 3.0 TW',
            'readings': [],
        })
        # Keep pronunciation/senses together. Never merge homographs' meanings.
        entry['readings'].append({
            'pronunciation': {'bopomofo': values[8], 'pinyin': values[11]},
            'part_of_speech': list(dict.fromkeys(re.findall(r'\[([^\[\]\r\n]{1,8})\]', values[15]))),
            'definitions': [values[15]] if values[15] else [],
            'examples': [],
            'examples_note': '例句保留於完整釋義原文；官方未提供獨立例句欄，不猜測拆分。',
            'source_row': row_number,
            'raw': dict(zip(headers, values)),
        })
        count += 1
    shards = [[] for _ in range(256)]
    for word, entry in entries.items():
        shards[hashlib.sha256(word.encode()).digest()[0]].append(entry)
    ROOT.mkdir(parents=True, exist_ok=True)
    files = []
    for number, entries_in_shard in enumerate(shards):
        payload = '\n'.join(json.dumps(entry, ensure_ascii=False, separators=(',', ':')) for entry in entries_in_shard) + '\n'
        packed = gzip.compress(payload.encode(), mtime=0)
        name = f'{number:02x}.jsonl.gz'
        (ROOT / name).write_bytes(packed)
        files.append({'file': name, 'entries': len(entries_in_shard), 'bytes': len(packed), 'sha256': hashlib.sha256(packed).hexdigest()})
    manifest = {'version': VERSION, 'source_url': SOURCE,
        'download_url': f'https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/download/dict_revised_{VERSION}.zip',
        'source_sha256': hashlib.sha256(raw).hexdigest(), 'source_rows': count,
        'entries': len(entries), 'partition': 'first byte of SHA256(UTF-8 exact headword)',
        'embedding': {'enabled': False, 'unit': 'one complete headword including all readings'},
        'files': files}
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'entries': len(entries), 'source_rows': count, 'compressed_bytes': sum(f['bytes'] for f in files)}))

if __name__ == '__main__':
    main()
