"""Discover and cache only problem/solution pairs linked by official BMT/SMT archives.
Requires: pip install beautifulsoup4. No guessed PDF URLs or third-party solutions.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,re,time,hashlib
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'data/official';CACHE.mkdir(parents=True,exist_ok=True)
ALLOWED={'berkeley.mt','sumo.stanford.edu'}
def download(url,path):
    if urlparse(url).hostname not in ALLOWED:raise ValueError('Non-official host: '+url)
    if path.exists():return path.read_bytes()
    error=None
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'FHS-MathClub-Archive-Importer/1.0'}),timeout=45) as response:
                blob=response.read()
            path.write_bytes(blob);return blob
        except Exception as e:error=e;time.sleep(attempt+1)
    raise error

def html(url):
    path=CACHE/(hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
    return BeautifulSoup(download(url,path),'html.parser')

def pair(competition,year,round_name,problem,solution,archive):
    return dict(competition=competition,year=year,round=round_name,problem_url=problem,solution_url=solution,archive_url=archive)

def discover():
    pairs=[];skipped=[]
    base='https://berkeley.mt/archives/'
    index=html(base)
    pages=sorted({urljoin(base,a['href']) for a in index.select('a[href]') if re.search(r'/archives/bmt-\d{4}/?$',urljoin(base,a['href']))})
    for url in pages:
        year=int(re.search(r'bmt-(\d{4})',url).group(1))
        for tr in html(url).select('tr'):
            cells=tr.find_all('td')
            if len(cells)<3:continue
            round_name=cells[0].get_text(' ',strip=True)
            links=[td.find('a',href=True) for td in cells[1:3]]
            if not all(links):skipped.append(dict(competition='BMT',year=year,round=round_name,reason='Official problem/solution pair not available'));continue
            if 'power' in round_name.lower():skipped.append(dict(competition='BMT',year=year,round=round_name,reason='Shared definitions and multipart proof context require a dedicated importer'));continue
            pairs.append(pair('BMT',year,round_name,urljoin(url,links[0]['href']),urljoin(url,links[1]['href']),url))
    url='https://sumo.stanford.edu/smt/'
    doc=html(url)
    for tr in doc.select('tr'):
        cells=tr.find_all('td')
        if len(cells)<3:continue
        title=tr.find_previous('h2');m=re.search(r'SMT\s+(\d{4})',title.get_text() if title else '')
        if not m:continue
        year=int(m.group(1));round_name=cells[0].get_text(' ',strip=True)
        kind=tr.find_previous('h3')
        if kind and 'tiebreak' in kind.get_text().lower():round_name+=' Tiebreaker'
        links=[td.find('a',href=True) for td in cells[1:3]]
        if not all(links):continue
        if 'power' in round_name.lower():skipped.append(dict(competition='SMT',year=year,round=round_name,reason='Shared definitions and multipart proof context require a dedicated importer'));continue
        pu,su=[urljoin(url,a['href']) for a in links]
        if not (pu.lower().endswith('.pdf') and su.lower().endswith('.pdf')):continue
        pairs.append(pair('SMT',year,round_name,pu,su,url))
    return pairs,skipped

def cache_pair(item):
    slug=re.sub(r'[^a-z0-9]+','-',f"{item['competition']}-{item['year']}-{item['round']}".lower()).strip('-')
    for role in ['problem','solution']:
        path=CACHE/(slug+'-'+role+'.pdf')
        blob=download(item[role+'_url'],path)
        if not blob.startswith(b'%PDF'):raise ValueError('Official link did not return a PDF')
        item[role+'_file']=str(path.relative_to(ROOT))
        item[role+'_sha256']=hashlib.sha256(blob).hexdigest()
    return item

if __name__=='__main__':
    pairs,skipped=discover();print(f'Discovered {len(pairs)} official problem/solution pairs',flush=True)
    downloaded=[]
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(cache_pair,p):p for p in pairs}
        for i,f in enumerate(as_completed(futures),1):
            p=futures[f]
            try:downloaded.append(f.result())
            except Exception as e:skipped.append(p|{'reason':str(e)})
            if i%15==0:print(f'Cached {i}/{len(pairs)} pairs',flush=True)
    downloaded.sort(key=lambda p:(p['competition'],-p['year'],p['round']))
    (CACHE/'manifest.json').write_text(json.dumps({'pairs':downloaded,'skipped':skipped},indent=2))
    print(f'Cached {len(downloaded)} pairs; {len(skipped)} unavailable or unsupported rounds',flush=True)
