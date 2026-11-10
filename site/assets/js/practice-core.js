/* Pure session state: no grades are inferred, and paused time is never counted. */
const PracticeCore=(()=>{
 const outcomes=new Set(['solved','review','skipped']);
 function create(items,minutes,now=Date.now(),pauseOnHide=true){
  if(!Array.isArray(items)||!items.length||items.length>25||new Set(items.map(x=>x.id)).size!==items.length)throw Error('Choose 1–25 distinct problems.');
  if(!Number.isFinite(minutes)||minutes<1||minutes>180)throw Error('Choose between 1 and 180 minutes.');
  const duration=Math.round(minutes*60);
  return{version:1,id:'set-'+now,status:'active',items,index:0,duration,remaining:duration,running:false,deadline:null,startedAt:now,finishedAt:null,pauseOnHide,outcomes:{},spent:{},revealed:{}};
 }
 function tick(s,now=Date.now()){
  if(s.status!=='active'||!s.running)return;
  const remaining=Math.max(0,Math.min(s.remaining,Math.ceil((s.deadline-now)/1000))),delta=s.remaining-remaining;
  const id=s.items[s.index].id;s.spent[id]=(s.spent[id]||0)+delta;s.remaining=remaining;
  if(!remaining){s.running=false;s.deadline=null;}
 }
 function pause(s,now=Date.now()){tick(s,now);s.running=false;s.deadline=null;}
 function resume(s,now=Date.now()){if(s.status==='active'&&s.remaining>0&&!s.running){s.deadline=now+s.remaining*1000;s.running=true;}}
 function finish(s,now=Date.now(),reason='finished'){pause(s,now);s.status='finished';s.finishedAt=now;s.reason=reason;}
 function assess(s,outcome){if(!outcomes.has(outcome))throw Error('Unknown self-assessment.');s.outcomes[s.items[s.index].id]=outcome;}
 function stats(s){const counts={solved:0,review:0,skipped:0,unmarked:0};for(const item of s.items){const outcome=s.outcomes[item.id];counts[outcomes.has(outcome)?outcome:'unmarked']++;}return{...counts,total:s.items.length,used:Math.max(0,s.duration-s.remaining),viewed:s.items.filter(x=>s.revealed[x.id]).length};}
 function restore(value,now=Date.now()){
  if(!value||value.version!==1||!['active','finished'].includes(value.status)||!Array.isArray(value.items)||!value.items.length||value.items.length>25)return null;
  if(value.items.some(x=>!x||typeof x.id!=='string'||typeof x.p!=='string'||typeof x.src!=='string')||new Set(value.items.map(x=>x.id)).size!==value.items.length)return null;
  if(!Number.isFinite(value.duration)||value.duration<60||value.duration>10800||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>value.duration||!Number.isInteger(value.index)||value.index<0||value.index>=value.items.length)return null;
  if(!value.outcomes||!value.spent||!value.revealed)return null;
  if(value.running&&!Number.isFinite(value.deadline))return null;
  if(value.status==='active'){tick(value,now);pause(value,now);}return value;
 }
 return{create,tick,pause,resume,finish,assess,stats,restore};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PracticeCore;
else window.FHSPracticeCore=PracticeCore;
