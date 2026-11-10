'use strict';
const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLabels={BMT:'BMT official archive',SMT:'SMT official archive',AMC:'AMC / AIME subset',AIME:'AIME archive',MATH:'MATH dataset',Forum:'AoPS community',Olympiad:'Olympiad collection',School:'School practice',OlympiadBench:'OlympiadBench'};
const sourceUrls={BMT:'https://berkeley.mt/archives/',SMT:'https://sumo.stanford.edu/smt/',AIME:'https://huggingface.co/datasets/di-zhang-fdu/AIME_1983_2024',MATH:'https://huggingface.co/datasets/EleutherAI/hendrycks_math',OlympiadBench:'https://huggingface.co/datasets/Hothan/OlympiadBench'};
function readSet(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.filter(x=>typeof x==='string'):[]);}catch{return new Set();}}
const saved=readSet('fhs-saved-v2'),solved=readSet('fhs-solved-v2'),review=readSet('fhs-review-v1');
let worker,manifest,currentItems=[],currentProblem=null,request=0,selectedSubject='',view='',currentPage=1,totalPages=1,toastTimer,dialogRequest=0;
const chunks=new Map();
let libraryReady=false,resolvingPermalink=new URL(location.href).searchParams.has('id');
const filterKeys=['competition','source','year','round','topic','difficulty'];
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function persist(){try{localStorage.setItem('fhs-saved-v2',JSON.stringify([...saved]));localStorage.setItem('fhs-solved-v2',JSON.stringify([...solved]));localStorage.setItem('fhs-review-v1',JSON.stringify([...review]));}catch{toast('Browser storage is unavailable. Progress lasts for this visit.');}updateWorkspace();}
function updateWorkspace(){$('#review-count').textContent=review.size;$('#review-view').classList.toggle('active',view==='review');$('#saved-count').textContent=saved.size;$('#solved-count').textContent=solved.size;$('#saved-view').classList.toggle('active',view==='saved');$('#solved-view').classList.toggle('active',view==='solved');}
function plain(text){return text.replace(/\[asy\][\s\S]*?\[\/asy\]/g,'[Diagram in source dataset]').replace(/\$+/g,'').replace(/\\(?:begin|end)\{[^}]+\}/g,'').replace(/\\(?:text|mathrm|mathbf)\{([^}]+)\}/g,'$1').replace(/\\(?:left|right|displaystyle)/g,'').replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g,'($1)/($2)').replace(/\\([a-z]+)/gi,'$1').replace(/[{}]/g,'').replace(/\s+/g,' ').trim();}
function title(r){if(r.official)return `${r.competition} ${r.yr} · ${r.round} · Problem ${r.number}`;if(r.src==='AIME')return `AIME ${r.id.replaceAll('-',' · ')}`;return `${r.topic} · ${r.id}`;}
function queryState(){return {q:$('#search').value,subject:selectedSubject,source:$('#source').value,competition:$('#competition').value,round:$('#round').value,difficulty:$('#difficulty').value,topic:$('#topic').value,year:$('#year').value,sort:$('#sort').value,view,saved:[...saved],solved:[...solved],review:[...review],page:currentPage};}
function writeFilterURL(){
 if(resolvingPermalink)return;
 const url=new URL(location.href),state=queryState();
 for(const key of ['q','subject','source','competition','round','difficulty','topic','year','sort','view','page']){
  const value=state[key];
  if(!value||(key==='sort'&&value==='default')||(key==='page'&&value===1))url.searchParams.delete(key);
  else url.searchParams.set(key,String(value));
 }
 if(url.href!==location.href)history.replaceState(null,'',url);
}
function issueQuery(changed=''){
 if(!worker)return;
 $('#problem-list').setAttribute('aria-busy','true');
 document.querySelectorAll('.problem-open,.bookmark,#prev,#next').forEach(button=>button.disabled=true);
 if(libraryReady)$('#result-count').textContent='Updating results…';
 worker.postMessage({type:'query',request:++request,changed,query:queryState()});
}
function reset(){
 clearTimeout(debounce);selectedSubject='';view='';$('#search').value='';
 filterKeys.forEach(id=>$('#'+id).value='');$('#sort').value='default';currentPage=1;
 updateSubjectButtons();updateWorkspace();issueQuery('reset');
}
function setControlsReady(ready){
 libraryReady=ready;window.FHSPractice?.setReady(ready);$('.filter-row').setAttribute('aria-busy',String(!ready));$('#search').setAttribute('aria-busy',String(!ready));
 for(const el of document.querySelectorAll('.filter-row select,#search,#sort,#beginner,#saved-view,#solved-view,#review-view,#build-set,#random-problem,[data-subject],[data-competition],[data-collection]'))el.disabled=!ready;
}
function applySearchState(data){
 setControlsReady(data.ready);
 if(!data.ready)return;
 for(const key of filterKeys)$('#'+key).value=data.filters[key]||'';
 selectedSubject=data.filters.subject||'';updateSubjectButtons();
 for(const key of filterKeys){
  const available=data.facets[key],select=$('#'+key);
  for(const option of select.options)option.disabled=Boolean(option.value&&!available[option.value]);
  select.disabled=Object.keys(available).length===0;
  if(key==='year')select.options[0].textContent=select.disabled?'Year not listed':'Any year';
  if(key==='round')select.options[0].textContent=select.disabled?'Round not listed':'All rounds';
 }
 for(const button of document.querySelectorAll('[data-subject]'))button.disabled=Boolean(button.dataset.subject&&!data.facets.subject[button.dataset.subject]);
 $('#filter-notice').textContent=data.cleared.length?'Cleared incompatible filters: '+data.cleared.join(', ')+'.':'';
 writeFilterURL();
}
function restoreFilters(params){
 selectedSubject=[...document.querySelectorAll('[data-subject]')].some(b=>b.dataset.subject===params.get('subject'))?params.get('subject'):'';
 $('#search').value=params.get('q')||'';
 for(const key of [...filterKeys,'sort']){
  const el=$('#'+key),value=params.get(key)|| (key==='sort'?'default':'');
  el.value=[...el.options].some(option=>option.value===value)?value:(key==='sort'?'default':'');
 }
 view=['saved','solved','review'].includes(params.get('view'))?params.get('view'):'';
 const page=Number(params.get('page'));currentPage=Number.isInteger(page)&&page>0?page:1;
 updateSubjectButtons();updateWorkspace();
}
function updateSubjectButtons(){document.querySelectorAll('[data-subject]').forEach(b=>(b.classList.toggle('active',b.dataset.subject===selectedSubject),b.setAttribute('aria-pressed',String(b.dataset.subject===selectedSubject))));}
function renderResults(d){if(d.request!==request)return;currentItems=d.items;if(d.ready)currentPage=d.page;totalPages=d.pages;applySearchState(d);
 $('#result-count').textContent=!d.ready?`Loading library… ${d.loaded.toLocaleString()} / ${manifest.total.toLocaleString()}`:d.error||`${d.total.toLocaleString()} ${d.total===1?'problem':'problems'}${d.complete?'':` · indexing ${d.loaded.toLocaleString()}…`}${view?` · ${view}`:''}`;
 $('#problem-list').setAttribute('aria-busy',String(!d.complete&&!d.error));
 if(!d.items.length){$('#problem-list').innerHTML=`<div class="empty-state"><strong>${d.error?'Some data could not load':d.complete?'No matching problems':'Searching the library…'}</strong>${d.error?'Refresh this page to retry loading the library.':d.complete?view?`Your ${view} list is empty with these filters.`:'No problems match these filters. Try a broader search.':'Loading the remaining collections.'}${d.complete?'<p><button class="text-link" id="empty-reset">Reset filters →</button></p>':''}</div>`;$('#empty-reset')?.addEventListener('click',reset);}
 else $('#problem-list').innerHTML=d.items.map(r=>`<div class="problem-row"><button class="problem-open" data-open="${escapeHtml(r.id)}"><span class="problem-id">${solved.has(r.id)?'<span class="solved-check" title="Solved">✓</span>':''}${escapeHtml(title(r))}</span><span class="problem-preview">${r.previewImage?`<img class="official-preview" src="${escapeHtml(r.previewImage)}" alt="Original official problem excerpt; open for the complete problem" loading="lazy">`:escapeHtml(normalizeMath(r.p.replace(/\[asy\][\s\S]*?\[\/asy\]/g,'[Diagram in source dataset]')))}</span><span class="problem-topic">${escapeHtml(r.subj)}${r.yr?' · '+r.yr:''}${r.official?' · Official problem + solution':r.solution?' · Solution available':r.answer?' · Answer available':''}</span></button><span class="collection-tag">${escapeHtml(r.src==='Forum'?'Community':r.src)}</span><span class="band ${escapeHtml(r.band)}">${escapeHtml(r.band)}</span><button class="bookmark ${saved.has(r.id)?'selected':''}" data-save="${escapeHtml(r.id)}" aria-label="${saved.has(r.id)?'Unsave':'Save'} ${escapeHtml(r.id)}" aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'★':'☆'}</button></div>`).join('');
 document.querySelectorAll('.problem-preview').forEach(renderMath);
 $('#page-info').textContent=d.total?`${(d.page-1)*10+1}–${Math.min(d.page*10,d.total)} of ${d.total.toLocaleString()}`:'No results';$('#page-number').textContent=`${d.page} / ${d.pages.toLocaleString()}`;$('#prev').disabled=!d.ready||d.page<=1;$('#next').disabled=!d.ready||d.page>=d.pages;
}
function normalizeMath(text){
 return String(text).replace(/\\textdollar\b/g,'\\$').replace(/\\begin\{(?:eqnarray\*?|align\*?)\}([\s\S]*?)\\end\{(?:eqnarray\*?|align\*?)\}/g,(_,body)=>'\\[\\begin{aligned}'+body.replace(/&\s*=\s*&/g,'&=')+'\\end{aligned}\\]');
}
function renderMath(el){if(window.renderMathInElement){renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}],throwOnError:false,trust:false});}}
function setMathContent(el,text){
 el.replaceChildren();el.classList.remove('official-content');
 const parts=normalizeMath(text).split(/(\[asy\][\s\S]*?\[\/asy\]|!?\[[^\]]*\]\(https?:\/\/[^\s]+\))/g);
 for(const part of parts){
  if(part.startsWith('[asy]')){const note=document.createElement('span');note.className='diagram-note';note.textContent='This problem includes an Asymptote diagram in the source data. The diagram is not rendered here; consult the original source for the figure.';el.append(note);continue;}
  const match=part.match(/^!?\[([^\]]*)\]\((https?:\/\/[^\s]+)\)$/);
  if(match){const a=document.createElement('a');a.href=match[2];a.textContent=match[1]||'View source diagram';a.target='_blank';a.rel='noopener';el.append(a);}else el.append(document.createTextNode(part));
 }
 renderMath(el);
}
function setOfficialContent(el,images,extracted,problem,kind){
 el.replaceChildren();el.classList.add('official-content');
 const note=document.createElement('p');note.className='official-art-note';note.textContent='Original '+(kind==='problem'?'problem':'solution')+' artwork · '+problem.competition+' '+problem.yr+' · '+problem.round;el.append(note);
 for(const [i,image] of images.entries()){
  const figure=document.createElement('figure'),link=document.createElement('a'),img=document.createElement('img');
  link.href=(kind==='problem'?problem.problem_url:problem.solution_url)+'#page='+image.page;link.target='_blank';link.rel='noopener';link.title='Open the original official PDF, page '+image.page;
  img.src=image.src;img.alt=title(problem)+' · official '+kind+' · page '+image.page;img.loading=kind==='solution'?'lazy':'eager';img.width=image.width;img.height=image.height;
  img.addEventListener('error',()=>{img.replaceWith(document.createTextNode('Artwork unavailable. Open the original official PDF ↗'));});
  link.append(img);figure.append(link);const caption=document.createElement('figcaption');caption.textContent='Official '+problem.competition+' '+kind+' paper · page '+image.page+(images.length>1?' · part '+(i+1)+' of '+images.length:'');figure.append(caption);el.append(figure);
 }
 const transcript=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('div');summary.textContent='Extracted text · formatting may differ from the original';text.className='archive-transcript';text.textContent=extracted;transcript.append(summary,text);el.append(transcript);
}
document.querySelectorAll('[data-competition]').forEach(button=>button.addEventListener('click',()=>{reset();$('#competition').value=button.dataset.competition;issueQuery('competition');$('#practice').scrollIntoView({behavior:'smooth'});}));
function updateProblemButtons(){if(!currentProblem)return;$('#review-problem').textContent=review.has(currentProblem.id)?'↻ In review queue':'↻ Review later';$('#review-problem').setAttribute('aria-pressed',String(review.has(currentProblem.id)));$('#review-problem').classList.toggle('selected',review.has(currentProblem.id));const id=currentProblem.id;$('#save-problem').textContent=saved.has(id)?'★ Saved':'☆ Save problem';$('#save-problem').classList.toggle('selected',saved.has(id));$('#save-problem').setAttribute('aria-pressed',String(saved.has(id)));$('#solve-problem').textContent=solved.has(id)?'✓ Solved':'✓ Mark solved';$('#solve-problem').classList.toggle('selected',solved.has(id));$('#solve-problem').setAttribute('aria-pressed',String(solved.has(id)));}
async function fetchChunk(file){if(!chunks.has(file)){chunks.set(file,fetch('assets/data/'+file).then(r=>{if(!r.ok)throw Error('Could not load problem');return r.json();}).catch(e=>{chunks.delete(file);throw e;}));}return chunks.get(file);}
async function openProblem(r){saveNotes();resetTimer();const ticket=++dialogRequest;currentProblem=r;$('#dialog-eyebrow').textContent=sourceLabels[r.src]||r.src;$('#dialog-title').textContent=title(r);$('#dialog-tags').innerHTML=`<span>${escapeHtml(r.subj)}</span>${r.topic!==r.subj?'<span>'+escapeHtml(r.topic)+'</span>':''}<span class="band ${escapeHtml(r.band)}">${escapeHtml(r.band)}${r.official?'':' · estimated'}</span>${r.yr?'<span>'+r.yr+'</span>':''}`;if(r.official)$('#statement').textContent='Loading original problem artwork…';else setMathContent($('#statement'),r.p);$('#solution-details').open=false;$('#solution').textContent=r.official?'Loading official solution…':'Loading supplied solution…';$('#solution-details summary').innerHTML=r.official?'Reveal official solution <span>+</span>':'Reveal supplied solution / answer <span>+</span>';$('#dialog-source').innerHTML=`Source: <a href="${sourceUrls[r.src]||'https://huggingface.co/datasets/AI-MO/NuminaMath-CoT'}" target="_blank" rel="noopener">${escapeHtml(sourceLabels[r.src]||r.src)} ↗</a>. Dataset solutions are supplied as-is and may contain errors.`;if(r.official)$('#dialog-source').innerHTML=`Official archive: <a href="${escapeHtml(r.problem_url)}#page=${r.problem_page}" target="_blank" rel="noopener">Original problem PDF ↗</a> · <a href="${escapeHtml(r.solution_url)}#page=${r.solution_page}" target="_blank" rel="noopener">Official solution PDF ↗</a>. Original notation and diagrams are preserved.`;loadNotes(r.id);updateProblemButtons();if(!$('#problem-dialog').open)$('#problem-dialog').showModal();$('#problem-dialog').scrollTop=0;window.FHSPractice?.onOpen(r);
 const url=new URL(location.href);url.searchParams.set('id',r.id);history.replaceState(null,'',url);
 try{const chunk=await fetchChunk(r.file);if(ticket!==dialogRequest)return;const full=chunk[r.offset];if(full.id!==r.id)throw Error('Problem index mismatch');currentProblem={...r,...full};if(full.official){setOfficialContent($('#statement'),full.problemImages,full.p,full,'problem');setOfficialContent($('#solution'),full.solutionImages,full.s,full,'solution');}else{setMathContent($('#statement'),full.p);setMathContent($('#solution'),[full.s,full.a?'Supplied answer: '+full.a:''].filter(Boolean).join('\n\n')||'No solution or answer is included in this dataset. Try discussing your approach at club.');}}catch{if(ticket===dialogRequest)$('#solution').textContent='The complete problem could not load. Close and reopen this problem to retry.';}
}
function closeProblem(){saveNotes();pauseTimer();window.FHSPractice?.onClose();++dialogRequest;const u=new URL(location.href);u.searchParams.delete('id');history.replaceState(null,'',u);}
$('#problem-dialog').addEventListener('close',closeProblem);$('#close-dialog').addEventListener('click',()=>$('#problem-dialog').close());$('#problem-dialog').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();});
$('#problem-list').addEventListener('click',e=>{const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save;saved.has(id)?saved.delete(id):saved.add(id);persist();issueQuery();return;}const b=e.target.closest('[data-open]');if(b){const r=currentItems.find(r=>r.id===b.dataset.open);if(r)openProblem(r);}});
$('#save-problem').addEventListener('click',()=>{if(!currentProblem)return;const id=currentProblem.id;saved.has(id)?saved.delete(id):saved.add(id);persist();updateProblemButtons();issueQuery();});
$('#solve-problem').addEventListener('click',()=>{if(!currentProblem)return;const id=currentProblem.id;solved.has(id)?solved.delete(id):solved.add(id);if(solved.has(id))review.delete(id);persist();updateProblemButtons();window.FHSPractice?.onSolved(id,solved.has(id));issueQuery();});
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Problem link copied.');}catch{toast('Copy the problem link from your address bar.');}});
$('#subject-list').addEventListener('click',e=>{const b=e.target.closest('[data-subject]');if(!b)return;selectedSubject=b.dataset.subject;currentPage=1;updateSubjectButtons();issueQuery('subject');});
$('#review-problem').addEventListener('click',()=>{if(!currentProblem)return;const id=currentProblem.id;review.has(id)?review.delete(id):review.add(id);persist();updateProblemButtons();window.FHSPractice?.onReview(id,review.has(id));issueQuery();});
for(const name of ['saved','solved','review'])$('#'+name+'-view').addEventListener('click',()=>{if(view===name)view='';else{reset();view=name;}currentPage=1;updateWorkspace();issueQuery();});
let debounce;$('#search').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>{currentPage=1;issueQuery();},150);});
['competition','source','difficulty','topic','year','round','sort'].forEach(id=>$('#'+id).addEventListener('change',()=>{currentPage=1;issueQuery(id);}));
$('#reset').addEventListener('click',reset);$('#beginner').addEventListener('click',()=>{reset();$('#difficulty').value='Easy';issueQuery('difficulty');});
for(const [id,direction] of [['prev',-1],['next',1]])$('#'+id).addEventListener('click',()=>{currentPage+=direction;issueQuery();});
document.querySelectorAll('[data-collection]').forEach(b=>b.addEventListener('click',()=>{reset();$('#source').value=b.dataset.collection;issueQuery('source');$('#practice').scrollIntoView({behavior:'smooth'});}));
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#problem-dialog').open){e.preventDefault();$('#search').focus();}});
let notesId=null,notesDirty=false,notesDebounce;
function saveNotes(){
 if(!notesId||!notesDirty)return;
 clearTimeout(notesDebounce);
 try{const value=$('#problem-notes').value;if(value.trim())localStorage.setItem('fhs-note-'+notesId,value);else localStorage.removeItem('fhs-note-'+notesId);notesDirty=false;$('#notes-status').textContent='Saved privately in this browser';}catch{$('#notes-status').textContent='Browser storage unavailable · copy your notes before leaving';}
}
function loadNotes(id){notesId=id;notesDirty=false;try{$('#problem-notes').value=localStorage.getItem('fhs-note-'+id)||'';$('#notes-status').textContent='Private · saved in this browser';}catch{$('#problem-notes').value='';$('#notes-status').textContent='Browser storage unavailable';}}
$('#problem-notes').addEventListener('input',()=>{notesDirty=true;$('#notes-status').textContent='Saving…';clearTimeout(notesDebounce);notesDebounce=setTimeout(saveNotes,400);});
window.addEventListener('pagehide',saveNotes);
let remaining=900,deadline=0,timerInterval=null;
function timerSeconds(){return $('#timer-duration').value==='custom'?Math.round(Math.max(1,Math.min(180,Number($('#timer-custom').value)||15))*60):Number($('#timer-duration').value);}
function drawTimer(){const minutes=Math.floor(remaining/60),seconds=remaining%60;$('#timer-clock').textContent=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');}
function pauseTimer(){if(timerInterval!==null){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));clearInterval(timerInterval);timerInterval=null;drawTimer();}$('#timer-toggle').textContent=remaining===timerSeconds()?'Start':'Resume';$('#timer-toggle').classList.remove('running');$('#timer-duration').disabled=false;$('#timer-custom').disabled=false;}
function resetTimer(){pauseTimer();$('#timer-custom').hidden=$('#timer-duration').value!=='custom';remaining=timerSeconds();drawTimer();$('#timer-status').textContent='';$('#timer-toggle').textContent='Start';}
function tickTimer(){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));drawTimer();if(!remaining){pauseTimer();$('#timer-toggle').textContent='Start again';$('#timer-status').textContent='Time is up.';}}
$('#timer-toggle').addEventListener('click',()=>{if(timerInterval!==null){pauseTimer();return;}if($('#timer-duration').value==='custom'&&!$('#timer-custom').checkValidity()){$('#timer-custom').reportValidity();return;}if(!remaining)remaining=timerSeconds();deadline=Date.now()+remaining*1000;timerInterval=setInterval(tickTimer,250);$('#timer-toggle').textContent='Pause';$('#timer-toggle').classList.add('running');$('#timer-duration').disabled=true;$('#timer-custom').disabled=true;$('#timer-status').textContent='';tickTimer();});
$('#timer-reset').addEventListener('click',resetTimer);$('#timer-duration').addEventListener('change',resetTimer);$('#timer-custom').addEventListener('change',resetTimer);$('#timer-custom').addEventListener('input',()=>{if($('#timer-custom').value&&$('#timer-custom').checkValidity())resetTimer();});
$('#random-problem').addEventListener('click',()=>{if(worker&&libraryReady){clearTimeout(debounce);issueQuery();worker.postMessage({type:'random'});}});
$('#print-problem').addEventListener('click',()=>{saveNotes();pauseTimer();window.print();});
window.addEventListener('fhs-math-ready',()=>document.querySelectorAll('.problem-preview,.math-content:not(.official-content)').forEach(renderMath));
window.FHSLibrary={
 get ready(){return libraryReady;},get current(){return currentProblem;},query:queryState,title,open:openProblem,
 pickSet(options){worker.postMessage({type:'practice-set',...options,query:queryState()});},
 mark(id,outcome){if(outcome==='solved'){solved.add(id);review.delete(id);}else if(outcome==='review')review.add(id);persist();updateProblemButtons();issueQuery();},
 toast
};
updateWorkspace();setControlsReady(false);
(async()=>{try{
 const response=await fetch('assets/data/library.json');if(!response.ok)throw Error('Manifest unavailable');manifest=await response.json();$('#total-count').textContent=manifest.total.toLocaleString();
 document.querySelectorAll('[data-archive-count]').forEach(el=>el.textContent=(manifest.officialCounts?.[el.dataset.archiveCount]||0).toLocaleString());
 $('#subject-list').insertAdjacentHTML('beforeend',Object.entries(manifest.subjects).map(([s,n])=>`<button class="subject" data-subject="${escapeHtml(s)}">${escapeHtml(s)} <span>${n.toLocaleString()}</span></button>`).join(''));
 $('#source').insertAdjacentHTML('beforeend',Object.keys(manifest.sources).map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(sourceLabels[s]||s)}</option>`).join(''));
 $('#topic').insertAdjacentHTML('beforeend',manifest.topics.map(t=>`<option>${escapeHtml(t)}</option>`).join(''));
 $('#competition').insertAdjacentHTML('beforeend',Object.keys(manifest.competitions||{}).sort().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}${c==='AIME'?' archive':' · official archive'}</option>`).join(''));
 $('#year').insertAdjacentHTML('beforeend',manifest.years.map(year=>`<option>${year}</option>`).join(''));
 $('#round').insertAdjacentHTML('beforeend',manifest.rounds.map(round=>`<option>${escapeHtml(round)}</option>`).join(''));
 const initial=new URL(location.href).searchParams;
 if(!resolvingPermalink)restoreFilters(initial);
 setControlsReady(false);
 worker=new Worker('assets/js/library-worker.js?v=14');worker.onerror=()=>{$('#result-count').textContent='Library search could not start. Reload this page to retry.';$('#problem-list').setAttribute('aria-busy','false');};
 const permalink=new URL(location.href).searchParams.get('id');let foundPermalink=!permalink;
 worker.onmessage=({data})=>{if(data.type==='practice-set'){window.FHSPractice?.receiveSet(data);return;}if(data.type==='random'){if(data.request!==request)return;if(data.item)openProblem(data.item);else toast('No unsolved problems match these filters. Try resetting them.');return;}if(data.type!=='results'||data.request!==request)return;renderResults(data);if(!foundPermalink){const r=data.items.find(r=>r.id===permalink);if(r){foundPermalink=true;resolvingPermalink=false;restoreFilters(initial);issueQuery('competition');openProblem(r);}else if(data.complete||data.error){foundPermalink=true;resolvingPermalink=false;toast('That problem link was not found in the available library.');restoreFilters(initial);issueQuery('competition');}}};
 if(permalink)$('#search').value=permalink;
 issueQuery('competition');worker.postMessage({type:'init',shards:manifest.shards});
 }catch{ $('#problem-list').innerHTML='<div class="empty-state"><strong>The library couldn’t load.</strong>Run this website with a local web server, then refresh this page.</div>';$('#result-count').textContent='Problem data unavailable';$('#problem-list').setAttribute('aria-busy','false');}
})();
