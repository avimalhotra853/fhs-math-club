"""Build a complete searchable index; statements/solutions stay in lazy chunks.
Run after build_site_data.py, and optionally fetch_olympiadbench.py.
Existing source IDs remain stable. Difficulty and keyword topic labels are estimates.
"""
from pathlib import Path
import json, re, collections, hashlib
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'site/assets/data'
entries=[]
seen_ids = set()
for file in sorted(OUT.glob('chunk_*.json')):
    for i, r in enumerate(json.loads(file.read_text())):
        if r['id'] in seen_ids:
            continue  # Older builds left stale chunks; index each original ID once.
        seen_ids.add(r['id'])
        entries.append((r, file.name, i))
raw=ROOT/'data/raw/olympiadbench.json'
if raw.exists():
    seen={re.sub(r'\W','',r['p'].lower()) for r,_,_ in entries}
    added=[]
    subjects={'Combinatorics':'Counting & Probability','Number Theory':'Number Theory','Geometry':'Geometry','Algebra':'Algebra'}
    for r in json.loads(raw.read_text()):
        p=r['question']; key=re.sub(r'\W','',p.lower())
        if key in seen: continue
        seen.add(key)
        subj=subjects.get(r.get('subfield'),'Algebra')
        added.append(dict(id=f"OB-{r['id']}",p=p,s='\n\n'.join(r.get('solution') or []),a='; '.join(r.get('final_answer') or []),src='OlympiadBench',subj=subj,topic=subj,lvl='Competition',d=9,band='Elite',yr=None,contest=''))
    file='olympiadbench.json'
    (OUT/file).write_text(json.dumps(added,separators=(',',':')))
    entries.extend((r,file,i) for i,r in enumerate(added))
# The original import only included the training split; add held-out MATH problems.
raw_test=ROOT/'data/raw/math_test.json'
if raw_test.exists():
    seen={re.sub(r'\W','',r['p'].lower()) for r,_,_ in entries}
    subjects={'algebra':'Algebra','intermediate_algebra':'Algebra','prealgebra':'Algebra','counting_and_probability':'Counting & Probability','geometry':'Geometry','number_theory':'Number Theory','precalculus':'Precalculus'}
    added=[]
    for r in json.loads(raw_test.read_text()):
        key=re.sub(r'\W','',r['problem'].lower())
        if key in seen: continue
        seen.add(key)
        subject=subjects[r['_config']]
        match=re.search(r'([1-5])',r.get('level',''))
        level=int(match.group(1)) if match else 3
        band={1:'Easy',2:'Easy',3:'Medium',4:'Hard',5:'Elite'}[level]
        added.append(dict(id=f"MT-{r['_config']}-{r['_offset']}",p=r['problem'],s=r.get('solution',''),a='',src='MATH',subj=subject,topic=subject,lvl=f'Dataset level {level}',d=level*2,band=band,yr=None,contest=''))
    for start in range(0,len(added),250):
        file=f'math_test_{start//250:03}.json'; batch=added[start:start+250]
        (OUT/file).write_text(json.dumps(batch,separators=(',',':')))
        entries.extend((r,file,i) for i,r in enumerate(batch))
# Official BMT/SMT records are validated against paired papers by the archive importer.
official_path=ROOT/'data/official/records.json'
if official_path.exists():
    official=json.loads(official_path.read_text())
    for start in range(0,len(official),100):
        file=f'official_{start//100:03}.json';batch=official[start:start+100]
        (OUT/file).write_text(json.dumps(batch,separators=(',',':')))
        entries.extend((r,file,i) for i,r in enumerate(batch))
# Do not repeat statements or solutions; preserve full statements for exact text search.
index=[]
for r,file,i in entries:
    index.append({k:r.get(k) for k in ('id','p','src','subj','topic','band','yr','contest','lvl','competition','round','number','official','problem_url','solution_url','archive_url','problem_page','solution_page') if r.get(k) is not None} | {'file':file,'offset':i,'solution':bool(r.get('s')),'answer':bool(r.get('a'))} | ({'previewImage':r['problemImages'][0]['src']} if r.get('official') else {}))
# Preserve official archive years and dataset-supplied AIME years; discard heuristic guesses.
for r in index:
    if r['src'] not in ('AIME','BMT','SMT'): r['yr'] = None
    if r['src']=='AIME': r['competition']='AIME'
    elif not r.get('official'): r['competition']=''
# IDs must uniquely address saved progress and permalinks.
ids=[r['id'] for r in index]
assert len(set(ids)) == len(ids), 'Duplicate problem IDs'
shards=[]
for i in range(0,len(index),1500):
    name=f'index_{i//1500:03}.json'
    (OUT/name).write_text(json.dumps(index[i:i+1500],separators=(',',':')))
    shards.append(name)
manifest={'total':len(index),'sources':dict(collections.Counter(r['src'] for r in index)),'subjects':dict(collections.Counter(r['subj'] for r in index)),'shards':shards,'years':sorted({r['yr'] for r in index if r['yr']},reverse=True),'topics':sorted({r['topic'] for r in index}),'version':hashlib.sha256(''.join(ids).encode()).hexdigest()[:12]}
manifest['competitions']=dict(collections.Counter(r['competition'] for r in index if r.get('competition')))
manifest['rounds']=sorted({r['round'] for r in index if r.get('official')})
manifest['competitionFacets']={c:{'years':sorted({r['yr'] for r in index if r.get('competition')==c and r['yr']},reverse=True),'rounds':sorted({r['round'] for r in index if r.get('competition')==c and r.get('round')})} for c in manifest['competitions']}
manifest['officialCounts']=dict(collections.Counter(r['competition'] for r in index if r.get('official')))
(OUT/'library.json').write_text(json.dumps(manifest,separators=(',',':')))
print(json.dumps(manifest | {'shards':len(shards),'topics':len(manifest['topics'])},indent=2))
