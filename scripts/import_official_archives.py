"""Import validated numbered BMT/SMT problems with original PDF artwork.
Requires pymupdf and pillow. Never synthesizes solutions or guesses archive URLs.
Run fetch_official_archives.py first. Problems with ambiguous boundaries are skipped.
"""
from pathlib import Path
import json,re,collections,hashlib
import pymupdf as pdf
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'data/official';OUT=ROOT/'site/assets/data';IMAGES=ROOT/'site/assets/official'
IMAGES.mkdir(parents=True,exist_ok=True)
LABEL=re.compile(r'^(?:Problem\s+)?(\d{1,2})\.(?:\s|$)',re.I)

def headings(doc):
    candidates=[]
    for pi,page in enumerate(doc):
        for b in page.get_text('dict')['blocks']:
            for line in b.get('lines',[]):
                text=''.join(s['text'] for s in line['spans']).strip()
                m=LABEL.match(text)
                if not m:continue
                x,y,_,_=line['bbox'];size=line['spans'][0]['size'];n=int(m.group(1))
                if x>115 or y>page.rect.height-32 or n<1:continue
                # TeX right-aligns two-digit labels; compare the shared right edge.
                anchor=x+(len(m.group(1))-1)*size*.5
                candidates.append(dict(n=n,page=pi,y=y,x=x,anchor=round(anchor/3)*3,text=text))
    if not candidates:return []
    anchor=collections.Counter(c['anchor'] for c in candidates).most_common(1)[0][0]
    candidates=sorted([c for c in candidates if abs(c['anchor']-anchor)<=2],key=lambda c:(c['page'],c['y']))
    selected=[];expected=1
    for c in candidates:
        if c['n']==expected:selected.append(c);expected+=1
    if not selected:return []
    # A later label above the sequence indicates a gap, so reject the paper.
    after=[c for c in candidates if (c['page'],c['y'])>(selected[-1]['page'],selected[-1]['y'])]
    if any(c['n']>selected[-1]['n'] for c in after):return []
    declared=re.search(r'contains\s+(\d+)\s+(?:short.answer\s+)?(?:questions|problems)',doc[0].get_text(),re.I)
    if declared and int(declared.group(1))!=len(selected):return []
    return selected

def regions(doc,starts,idx):
    start=starts[idx];end=starts[idx+1] if idx+1<len(starts) else None
    last=end['page'] if end else len(doc)-1
    for pi in range(start['page'],last+1):
        page=doc[pi]
        top=max(20,start['y']-7) if pi==start['page'] else 24
        bottom=end['y']-7 if end and pi==end['page'] else page.rect.height-26
        if bottom<=top+3:continue
        clip=pdf.Rect(30,top,page.rect.width-30,bottom)
        # Omit empty continuation/cover regions. Figure-only regions are retained.
        if not page.get_text(clip=clip).strip() and not page.get_images():continue
        yield pi,clip

def extract(doc,starts,idx):
    return '\n'.join(doc[pi].get_text(clip=clip).strip() for pi,clip in regions(doc,starts,idx)).strip()

def render(doc,starts,idx,slug,kind):
    paths=[]
    for part,(pi,clip) in enumerate(regions(doc,starts,idx),1):
        name=f'{slug}-{kind}-{part}.webp';path=IMAGES/name
        if not path.exists():
            pix=doc[pi].get_pixmap(matrix=pdf.Matrix(1.8,1.8),clip=clip,alpha=False)
            Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(path,'WEBP',quality=94,method=4)
        paths.append(dict(src='assets/official/'+name,page=pi+1,width=round(clip.width*1.8),height=round(clip.height*1.8)))
    return paths

def signature(s):return re.sub(r'[^a-z0-9]','',s.lower())

def main():
    manifest=json.loads((CACHE/'manifest.json').read_text());records=[];report=[]
    subject_map={'Algebra':'Algebra','Geometry':'Geometry','Calculus':'Calculus','Discrete':'Discrete Math','Number Theory':'Number Theory','Combinatorics':'Counting & Probability','Advanced Topics':'Advanced Topics'}
    for pair in manifest['pairs']:
        try:
            problem=pdf.open(ROOT/pair['problem_file']);solution=pdf.open(ROOT/pair['solution_file'])
            ph,sh=headings(problem),headings(solution)
            if not ph or not sh or len(ph)!=len(sh):
                report.append(pair|{'status':'skipped','reason':f'Unverified numbering: {len(ph)} problem labels / {len(sh)} solution labels'});continue
            if [h['n'] for h in ph]!=[h['n'] for h in sh]:raise ValueError('Number sequences differ')
            # A repeated question in the solution paper is an independent matching check.
            # If headings differ, do not guess whether two labels refer to the same question.
            checks=[]
            for a,b in zip(ph,sh):
                aa,bb=signature(LABEL.sub('',a['text'])),signature(LABEL.sub('',b['text']))
                checks.append(not aa or not bb or aa.startswith(bb[:30]) or bb.startswith(aa[:30]))
            if not all(checks):
                report.append(pair|{'status':'skipped','reason':'Problem and solution heading text could not be matched'});continue
            round_name=pair['round'];base_round=round_name.replace(' Tiebreaker','')
            subject=subject_map.get(base_round,'Mixed Topics')
            slug=re.sub('[^a-z0-9]+','-',f"{pair['competition']}-{pair['year']}-{round_name}".lower()).strip('-')
            for i,h in enumerate(ph):
                n=h['n'];pid=f"{pair['competition']}-{pair['year']}-{re.sub('[^a-z0-9]+','-',round_name.lower()).strip('-')}-{n}"
                p=extract(problem,ph,i);s=extract(solution,sh,i)
                if len(p)<8 or len(s)<10:raise ValueError('Empty source extraction')
                pimages=render(problem,ph,i,pid.lower(),'problem');simages=render(solution,sh,i,pid.lower(),'solution')
                records.append(dict(id=pid,p=p,s=s,a='',src=pair['competition'],competition=pair['competition'],contest=pair['competition'],yr=pair['year'],round=round_name,number=n,subj=subject,topic=base_round,lvl='Official archive · unrated',band='Unrated',official=True,problemImages=pimages,solutionImages=simages,problem_url=pair['problem_url'],solution_url=pair['solution_url'],archive_url=pair['archive_url'],problem_page=h['page']+1,solution_page=sh[i]['page']+1,problem_sha256=pair['problem_sha256'],solution_sha256=pair['solution_sha256']))
            report.append(pair|{'status':'imported','count':len(ph)})
            problem.close();solution.close()
        except Exception as e:report.append(pair|{'status':'skipped','reason':str(e)})
    ids=[r['id'] for r in records];assert len(ids)==len(set(ids))
    # A failure within a paper cannot leave a partial/possibly misaligned import.
    accepted={(p['competition'],p['year'],p['round']) for p in report if p['status']=='imported'}
    records=[r for r in records if (r['competition'],r['yr'],r['round']) in accepted]
    records.sort(key=lambda r:(r['competition'],-r['yr'],r['round'],r['number']))
    (CACHE/'records.json').write_text(json.dumps(records,separators=(',',':')))
    summary={'total':len(records),'counts':dict(collections.Counter(r['competition'] for r in records)),'papers_imported':sum(p['status']=='imported' for p in report),'papers_skipped':sum(p['status']=='skipped' for p in report),'report':report,'archive_skips':manifest['skipped']}
    (CACHE/'import-report.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps({k:v for k,v in summary.items() if k not in ('report','archive_skips')},indent=2))
    for c in ('BMT','SMT'):
        print(c,'years:',sorted({r['yr'] for r in records if r['competition']==c}),'rounds:',sorted({r['round'] for r in records if r['competition']==c}))
    print('Skipped examples:',[(r['competition'],r['year'],r['round'],r.get('reason')) for r in report if r['status']=='skipped'][:12])
if __name__=='__main__':main()
