/* Timed sets and review are personal browser-local practice tools, not an auto-grader. */
(() => {
 const core=window.FHSPracticeCore,library=window.FHSLibrary,$=s=>document.querySelector(s);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=$('#practice-dialog'),problemDialog=$('#problem-dialog');
 let session=null,inSet=false,pendingRun=false,pendingToken=null,pendingOptions=null,storageWarning=false,lastCheckpoint=0;
 const clock=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 try{session=core.restore(JSON.parse(localStorage.getItem('fhs-practice-v1')||'null'));if(session?.status==='active'&&!session.remaining)core.finish(session,Date.now(),'time');}catch{session=null;}
 function save(){try{if(session)localStorage.setItem('fhs-practice-v1',JSON.stringify(session));}catch{if(!storageWarning){library.toast('Session storage is unavailable. Keep this tab open to retain your set.');storageWarning=true;}}}
 function isActive(){return session?.status==='active';}
 function renderClock(){
  document.querySelectorAll('[data-set-clock]').forEach(el=>el.textContent=clock(session?.remaining||0));
  $('#set-panel-pause').textContent=session?.running?'Pause':'Resume';
  if(isActive()){
   const stats=core.stats(session);$('#active-set-detail').textContent=`${stats.total-stats.unmarked} of ${stats.total} marked · ${session.running?'Running':'Paused'}`;
  }
 }
 function render(){
  const active=isActive();$('#active-set-bar').hidden=!active;$('#last-set').hidden=!session||active;
  $('#build-set').textContent=active?'Resume practice set':'Timed practice set';$('#build-set').disabled=!library.ready;
  $('#set-question-panel').hidden=!(active&&inSet);$('.focus-timer').hidden=Boolean(active&&inSet);
  if(active){
   $('#active-set-label').textContent=`Practice set · ${session.items.length} problems`;
   $('#set-question-number').textContent=`Problem ${session.index+1} of ${session.items.length}`;
   $('#set-problem-nav').innerHTML=session.items.map((item,i)=>`<button type="button" data-set-index="${i}" class="${i===session.index?'current ':''}${escape(session.outcomes[item.id]||'unmarked')}" aria-label="Problem ${i+1}: ${escape(session.outcomes[item.id]||'not marked')}" ${i===session.index?'aria-current="step"':''}>${i+1}</button>`).join('');
   const current=session.items[session.index],outcome=session.outcomes[current.id];
   document.querySelectorAll('[data-set-outcome]').forEach(button=>{const chosen=button.dataset.setOutcome===outcome;button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));});
   $('#set-prev').disabled=session.index===0;$('#set-next').disabled=false;$('#set-next').textContent=session.index===session.items.length-1?'Finish set →':'Next problem →';
   $('#set-solution-note').textContent=session.revealed[current.id]?'Answer / solution opened':'';
  }
  renderClock();
 }
 function closeSetup(){pendingToken=null;$('#set-start').disabled=false;if(dialog.open)dialog.close();}
 function openSetup(){
  if(!library.ready){library.toast('Wait for the problem library to finish loading.');return;}
  if(isActive()){resumeSet();return;}
  $('#set-setup').hidden=false;$('#set-summary').hidden=true;$('#practice-heading').textContent='Build a practice set';$('#set-form-message').textContent='';$('#set-start').disabled=false;
  const query=library.query(),names={competition:'Competition',year:'Year',round:'Round',subject:'Subject',source:'Collection',topic:'Topic',difficulty:'Difficulty',q:'Search',view:'Workspace'};
  $('#set-filter-context').innerHTML=Object.entries(names).filter(([key])=>query[key]).map(([key,name])=>`<span>${name}: ${escape(query[key])}</span>`).join('')||'<span>All library problems</span>';
  $('#set-unsolved').checked=query.view!=='review';
  if(!dialog.open)dialog.showModal();
 }
 function resumeSet(){
  if(!isActive())return;
  closeSetup();pendingRun=true;library.open(session.items[session.index]);
 }
 function move(index){
  if(!isActive()||index<0||index>=session.items.length)return;
  const running=session.running;core.pause(session);session.index=index;pendingRun=running;save();library.open(session.items[index]);
 }
 function assess(outcome){
  if(!isActive()||!inSet)return;
  core.tick(session);core.assess(session,outcome);library.mark(session.items[session.index].id,outcome);save();render();
 }
 function showSummary(){
  if(!session||session.status!=='finished')return;
  $('#set-setup').hidden=true;$('#set-summary').hidden=false;$('#practice-heading').textContent='Practice set summary';
  const stats=core.stats(session),labels={solved:'Solved',review:'Review later',skipped:'Skipped'};
  $('#set-summary').innerHTML=`<h2>${session.reason==='time'?'Time’s up.':'Practice complete.'}</h2><p class="set-description">${clock(stats.used)} used of ${clock(session.duration)}. Results below are self-assessed, not automatically graded.</p><div class="set-summary-metrics"><div><strong>${stats.solved}</strong><span>Marked solved</span></div><div><strong>${stats.review}</strong><span>Review later</span></div><div><strong>${stats.skipped}</strong><span>Skipped</span></div><div><strong>${stats.unmarked}</strong><span>Not marked</span></div></div><div class="set-summary-list">${session.items.map((item,i)=>`<button class="set-summary-row" data-summary-index="${i}"><span><strong>${escape(library.title(item))}</strong><small>${clock(session.spent[item.id]||0)} on this problem${session.revealed[item.id]?' · Answer / solution opened':''}</small></span><span class="set-outcome-label ${escape(session.outcomes[item.id]||'unmarked')}">${labels[session.outcomes[item.id]]||'Not marked'}</span></button>`).join('')}</div><p class="small-note">Review-later problems are in your review queue. Your notes and set summary stay in this browser.</p><div class="set-summary-actions"><button id="another-set" class="button primary">Build another set →</button><button id="clear-set-summary" class="text-link">Clear summary</button></div>`;
  $('#another-set').addEventListener('click',openSetup);
  $('#clear-set-summary').addEventListener('click',()=>{session=null;inSet=false;try{localStorage.removeItem('fhs-practice-v1');}catch{library.toast('Browser storage is unavailable.');}closeSetup();render();});
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
 }
 function finish(reason='finished'){
  if(!isActive())return;
  core.finish(session,Date.now(),reason);inSet=false;pendingRun=false;save();render();
  if(problemDialog.open)problemDialog.close();showSummary();
 }
 function onOpen(problem){
  const index=isActive()?session.items.findIndex(item=>item.id===problem.id):-1;
  if(isActive()){
   const running=session.running;core.pause(session);inSet=index>=0;
   if(inSet){session.index=index;if(pendingRun||running)core.resume(session);}
   pendingRun=false;save();
  }else inSet=false;
  render();
 }
 function onClose(){if(isActive()){core.pause(session);inSet=false;save();render();}}
 window.FHSPractice={
  setReady(){render();},onOpen,onClose,
  onSolved(id,value){if(!isActive()||!inSet||session.items[session.index].id!==id)return;if(value)core.assess(session,'solved');else if(session.outcomes[id]==='solved')delete session.outcomes[id];save();render();},
  onReview(id,value){if(!isActive()||!inSet||session.items[session.index].id!==id)return;if(value)core.assess(session,'review');else if(session.outcomes[id]==='review')delete session.outcomes[id];save();render();},
  receiveSet(data){
   if(data.token!==pendingToken||!dialog.open)return;
   pendingToken=null;$('#set-start').disabled=false;
   if(data.error||!data.items.length){$('#set-form-message').textContent=data.error||'No matching problems. Try broader filters or include problems already marked solved.';return;}
   session=core.create(data.items,pendingOptions.minutes,Date.now(),pendingOptions.pauseOnHide);save();
   if(data.items.length<pendingOptions.size)library.toast(`Only ${data.items.length} matching problems were available; this set includes all of them.`);
   closeSetup();pendingRun=true;library.open(session.items[0]);
  }
 };
 $('#build-set').addEventListener('click',openSetup);$('#resume-set').addEventListener('click',resumeSet);$('#last-set').addEventListener('click',showSummary);
 $('#practice-close').addEventListener('click',closeSetup);dialog.addEventListener('close',()=>{pendingToken=null;$('#set-start').disabled=false;});
 $('#practice-form').addEventListener('submit',event=>{
  event.preventDefault();if(!library.ready||!$('#practice-form').reportValidity())return;
  pendingOptions={minutes:Number($('#set-minutes').value),size:Number($('#set-size').value),pauseOnHide:$('#set-pause-hidden').checked};
  pendingToken='pick-'+Date.now();$('#set-start').disabled=true;$('#set-form-message').textContent='Selecting problems…';
  library.pickSet({token:pendingToken,size:pendingOptions.size,unsolved:$('#set-unsolved').checked});
 });
 $('#finish-set').addEventListener('click',()=>finish());$('#set-panel-finish').addEventListener('click',()=>finish());
 $('#set-panel-pause').addEventListener('click',()=>{if(!isActive())return;session.running?core.pause(session):core.resume(session);save();renderClock();});
 $('#set-prev').addEventListener('click',()=>move(session.index-1));$('#set-next').addEventListener('click',()=>{if(!isActive())return;session.index===session.items.length-1?finish():move(session.index+1);});
 $('#set-problem-nav').addEventListener('click',event=>{const button=event.target.closest('[data-set-index]');if(button)move(Number(button.dataset.setIndex));});
 document.querySelectorAll('[data-set-outcome]').forEach(button=>button.addEventListener('click',()=>assess(button.dataset.setOutcome)));
 $('#set-summary').addEventListener('click',event=>{const button=event.target.closest('[data-summary-index]');if(!button||!session)return;closeSetup();library.open(session.items[Number(button.dataset.summaryIndex)]);});
 $('#solution-details').addEventListener('toggle',()=>{if(!isActive()||!inSet||!$('#solution-details').open)return;const record=library.current;if(!(record?.solution||record?.answer||record?.s||record?.a))return;session.revealed[session.items[session.index].id]=true;save();render();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&isActive()&&session.pauseOnHide){core.pause(session);save();renderClock();}});
 window.addEventListener('pagehide',()=>{if(isActive())core.pause(session);save();});
 setInterval(()=>{
  if(!isActive()||!session.running)return;
  core.tick(session);renderClock();
  if(!session.remaining){finish('time');return;}
  if(Date.now()-lastCheckpoint>5000){save();lastCheckpoint=Date.now();}
 },250);
 render();
})();
