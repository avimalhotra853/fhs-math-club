"""Validate imported provenance, asset integrity, and paired paper coverage."""
import json,collections,hashlib
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
rows=json.loads((ROOT/'data/official/records.json').read_text())
report=json.loads((ROOT/'data/official/import-report.json').read_text())
expected={(r['competition'],r['year'],r['round']):r for r in report['report'] if r['status']=='imported'}
assert rows and len({r['id'] for r in rows})==len(rows)
files={}
for r in rows:
    assert r['official'] is True and r['band']=='Unrated'
    assert r['src']==r['competition'] and r['competition'] in ('BMT','SMT')
    assert r['problemImages'] and r['solutionImages'] and r['p'] and r['s']
    paper=expected[r['competition'],r['yr'],r['round']]
    for role in ('problem','solution'):
        assert r[role+'_url']==paper[role+'_url']
        assert urlparse(r[role+'_url']).hostname==('berkeley.mt' if r['competition']=='BMT' else 'sumo.stanford.edu')
        path=ROOT/paper[role+'_file']
        if path not in files:files[path]=hashlib.sha256(path.read_bytes()).hexdigest()
        assert files[path]==r[role+'_sha256']
        for part in r[role+'Images']:
            image=ROOT/'site'/part['src'];assert image.exists() and image.stat().st_size>50
            assert part['page']>0 and part['height']>0
for key,paper in expected.items():
    actual=[r['number'] for r in rows if (r['competition'],r['yr'],r['round'])==key]
    assert sorted(actual)==list(range(1,paper['count']+1))
print(f"PASS: {len(rows)} official problems in {len(expected)} paired papers; official-host provenance, original PDF hashes, complete numbering, and problem/solution artwork verified.")
print(dict(collections.Counter(r['competition'] for r in rows)))
