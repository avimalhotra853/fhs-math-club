/* Integrity and background-search regression checks. Run: node scripts/check_library.cjs */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=path.join(__dirname,'../site/assets/data');
const manifest=JSON.parse(fs.readFileSync(path.join(data,'library.json')));
const records=manifest.shards.flatMap(f=>JSON.parse(fs.readFileSync(path.join(data,f))));
assert.equal(records.length,manifest.total);
assert.equal(new Set(records.map(r=>r.id)).size,records.length,'Problem IDs must be unique');
const cache=new Map();
for(const r of records){if(!cache.has(r.file))cache.set(r.file,JSON.parse(fs.readFileSync(path.join(data,r.file))));const source=cache.get(r.file)[r.offset];assert.equal(source.id,r.id);assert.equal(source.p,r.p);assert.equal(Boolean(source.s),r.solution);if(r.yr)assert.ok(['AIME','BMT','SMT'].includes(r.src),'Only official or dataset-supplied years are exposed');}
let messages=[];
const sandbox={postMessage:m=>messages.push(m),fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(data,path.basename(url))))}),Date,Set};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/assets/js/library-worker.js'),'utf8'),sandbox);
function query(q,changed=''){sandbox.onmessage({data:{type:'query',request:1,changed,query:q}});return messages.at(-1);}
(async()=>{
 await sandbox.onmessage({data:{type:'init',shards:manifest.shards}});
 assert.equal(query({}).total,manifest.total);
 for(const source of Object.keys(manifest.sources)){
  const result=query({source});assert.equal(result.total,manifest.sources[source]);assert.ok(result.items.every(r=>r.src===source));
 }
 const combined={source:'MATH',subject:'Geometry',difficulty:'Hard'};
 const expected=records.filter(r=>r.src==='MATH'&&r.subj==='Geometry'&&r.band==='Hard');
 assert.equal(query(combined).total,expected.length);
 for(const competition of ['BMT','SMT']){
  assert.ok(manifest.officialCounts[competition]>0);
  const result=query({competition});assert.equal(result.total,manifest.officialCounts[competition]);assert.ok(result.items.every(r=>r.official&&r.competition===competition));
  const sample=records.find(r=>r.competition===competition),filters={competition,year:String(sample.yr),round:sample.round};
  const subset=records.filter(r=>r.competition===competition&&r.yr===sample.yr&&r.round===sample.round);
  const filtered=query(filters);assert.equal(filtered.total,subset.length);assert.ok(filtered.items.every(r=>r.competition===competition&&r.round===sample.round&&r.yr===sample.yr));
 }
 assert.equal(query({competition:'BMT',round:'not-a-real-round'}).total,0);
 const recovered=query({competition:'AIME',year:'2024',round:'General',difficulty:'Easy'},'competition');
 assert.equal(recovered.filters.competition,'AIME');assert.equal(recovered.filters.year,'2024');
 assert.equal(recovered.filters.difficulty,'');assert.equal(recovered.filters.round,'');
 assert.ok(recovered.total>0,'Switching competitions must recover from stale difficulty and round filters');
 assert.ok(!recovered.facets.difficulty.Easy,'Unavailable difficulty is not offered for AIME');
 const bmt=query({competition:'BMT',year:'2025',round:'General'});
 assert.ok(bmt.facets.competition.SMT,'A year selection must never prevent switching competitions');
 assert.ok(bmt.facets.year['2024'],'A round selection must not prevent changing years');
 assert.ok(bmt.facets.difficulty.Unrated);assert.ok(!bmt.facets.difficulty.Easy);
 const switched=query({competition:'SMT',year:'2025',round:'General'},'competition');
 assert.equal(switched.filters.competition,'SMT');assert.equal(switched.filters.year,'');assert.ok(switched.total>0);
 const geometry=query({competition:'BMT',year:'2024',round:'General',subject:'Geometry'},'subject');
 assert.equal(geometry.filters.subject,'Geometry');assert.equal(geometry.filters.round,'');assert.ok(geometry.total>0);
 assert.equal(query({competition:'BMT',year:'2024'}).facets.round.Analysis,undefined,'Rounds reflect the chosen year');
 assert.equal(query({page:0}).page,1);assert.equal(query({page:999999}).page,Math.ceil(manifest.total/10));

 const text='triangle';assert.equal(query({q:text}).total,records.filter(r=>[r.p,r.id,r.src,r.subj,r.topic,r.competition,r.round,r.contest,r.yr].join(' ').toLowerCase().includes(text)).length);
 assert.equal(query({q:'1983-1'}).items[0].id,'1983-1');
 assert.equal(query({q:'AMC-1000',sort:'easiest'}).items[0].id,'AMC-1000','Exact permalink ID must appear before partial matches');
 const p1=query({source:'AIME',page:1}),p2=query({source:'AIME',page:2});assert.equal(p2.page,2);assert.ok(!p2.items.some(r=>p1.items.some(x=>x.id===r.id)));
 assert.equal(query({view:'saved',saved:['1983-1']}).total,1);
 assert.equal(query({view:'solved',solved:['1983-1']}).items[0].id,'1983-1');
 assert.equal(query({source:'School',year:'1983'}).total,0);
 assert.equal(query({q:'no_such_problem_xyz_987654321'}).total,0);
 query({source:'OlympiadBench',subject:'Geometry'});
 sandbox.onmessage({data:{type:'random'}});const random=messages.at(-1);
 assert.equal(random.type,'random');assert.equal(random.item.src,'OlympiadBench');assert.equal(random.item.subj,'Geometry');
 query({view:'saved',saved:['1983-1'],solved:['1983-1']});sandbox.onmessage({data:{type:'random'}});assert.equal(messages.at(-1).item,null,'Random practice excludes solved problems');
 query({view:'review',review:['1983-1']});assert.equal(messages.at(-1).total,1);assert.equal(messages.at(-1).items[0].id,'1983-1');
 const setQuery={competition:'BMT',year:'2024',round:'General',solved:['BMT-2024-general-1']};
 sandbox.onmessage({data:{type:'practice-set',token:'test-set',query:setQuery,size:5,unsolved:true}});const set=messages.at(-1);
 assert.equal(set.type,'practice-set');assert.equal(set.token,'test-set');assert.equal(set.items.length,5);assert.equal(new Set(set.items.map(r=>r.id)).size,5);assert.ok(set.items.every(r=>r.competition==='BMT'&&r.yr===2024&&r.round==='General'&&r.id!=='BMT-2024-general-1'));
 sandbox.onmessage({data:{type:'practice-set',token:'small-set',query:{view:'review',review:['1983-1']},size:25,unsolved:false}});assert.equal(messages.at(-1).items.length,1,'Small result pools must not duplicate problems');
 sandbox.onmessage({data:{type:'practice-set',token:'no-set',query:{view:'review',review:['1983-1'],solved:['1983-1']},size:5,unsolved:true}});assert.equal(messages.at(-1).items.length,0);
 console.log(`PASS: ${records.length.toLocaleString()} problem pointers, unique IDs, official competition/year/round facets, full-text search, combined filters, exact permalinks, collection totals, pagination, and progress views.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
