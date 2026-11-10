"""Add the MATH dataset's held-out competition problems (all seven subjects)."""
import json, urllib.request, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
CONFIGS=['algebra','counting_and_probability','geometry','intermediate_algebra','number_theory','prealgebra','precalculus']
def get(path,params):
    url='https://datasets-server.huggingface.co/'+path+'?'+urllib.parse.urlencode(params)
    with urllib.request.urlopen(url,timeout=60) as response: return json.load(response)
def page(task):
    config,offset=task
    data=get('rows',dict(dataset='EleutherAI/hendrycks_math',config=config,split='test',offset=offset,length=100))
    if any(r.get('truncated_cells') for r in data['rows']): raise RuntimeError('Truncated source rows')
    return [dict(r['row'],_config=config,_offset=offset+i) for i,r in enumerate(data['rows'])]
if __name__=='__main__':
    info=get('info',dict(dataset='EleutherAI/hendrycks_math'))['dataset_info']
    tasks=[(c,n) for c in CONFIGS for n in range(0,info[c]['splits']['test']['num_examples'],100)]
    with ThreadPoolExecutor(max_workers=5) as pool: rows=[r for batch in pool.map(page,tasks) for r in batch]
    (ROOT/'data/raw/math_test.json').write_text(json.dumps(rows,ensure_ascii=False))
    print(f'Downloaded {len(rows)} held-out MATH problems')
