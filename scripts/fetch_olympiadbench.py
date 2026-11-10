"""Download the English text-only competition split (674 rows), with provenance."""
import json, urllib.request, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/raw/olympiadbench.json'
def page(offset):
    params = dict(dataset='Hothan/OlympiadBench', config='OE_TO_maths_en_COMP', split='train', offset=offset, length=100)
    url = 'https://datasets-server.huggingface.co/rows?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=45) as response:
        data = json.load(response)
    if any(r.get('truncated_cells') for r in data['rows']):
        raise RuntimeError('Dataset returned truncated content')
    return [r['row'] for r in data['rows']]
if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [r for batch in pool.map(page, range(0, 674, 100)) for r in batch]
    assert len(rows) == 674
    OUT.write_text(json.dumps(rows, ensure_ascii=False))
    print(f'Downloaded {len(rows)} original dataset records to {OUT}')
