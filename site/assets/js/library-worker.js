/* Search and faceting stay together so every control uses the same record metadata. */
let records = [], complete = false, loadError = '', query = {}, latestQuery = 0, changedKey = '';
const fields = { competition: 'competition', source: 'src', year: 'yr', round: 'round', subject: 'subj', topic: 'topic', difficulty: 'band' };
const keys = Object.keys(fields);
const bandRank = { Easy: 0, Medium: 1, Hard: 2, Elite: 3, Unrated: 4 };
const valueOf = (record, key) => String(record[fields[key]] ?? '');

function reconcileFilters() {
  // The user's newest choice wins. Clear older choices only when they conflict.
  if (!fields[changedKey]) return [];
  const priority = [...new Set([changedKey, ...keys])].filter(key => fields[key]);
  let candidates = records;
  const cleared = [];
  for (const key of priority) {
    if (!query[key]) continue;
    const matching = candidates.filter(record => valueOf(record, key) === String(query[key]));
    if (matching.length) candidates = matching;
    else { query[key] = ''; cleared.push(key); }
  }
  changedKey = '';
  return cleared;
}

function search(pickRandom = false) {
  const ready = complete || Boolean(loadError);
  const cleared = ready ? reconcileFilters() : [];
  const terms = (query.q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const saveSet = new Set(query.saved || []), solveSet = new Set(query.solved || []), reviewSet = new Set(query.review || []);
  const active = keys.filter(key => query[key]);
  const parents = {
    competition: [], source: ['competition'], year: ['competition', 'source'],
    round: ['competition', 'source', 'year'], subject: ['competition', 'source'],
    topic: ['competition', 'source', 'subject'], difficulty: ['competition', 'source']
  };
  const facets = Object.fromEntries(keys.map(key => [key, {}]));
  const found = [];
  for (const record of records) {
    const failed = active.filter(key => valueOf(record, key) !== String(query[key]));
    // Parent choices restrict child options; older child choices never block a parent.
    for (const key of keys) {
      if (!parents[key].every(parent => !query[parent] || valueOf(record, parent) === String(query[parent]))) continue;
      const value = valueOf(record, key);
      if (value) facets[key][value] = (facets[key][value] || 0) + 1;
    }
    if (failed.length) continue;
    if (query.view && !({saved:saveSet,solved:solveSet,review:reviewSet}[query.view]||new Set()).has(record.id)) continue;
    if (terms.every(term => record.searchText.includes(term))) found.push(record);
  }
  if (pickRandom) {
    const unsolved = found.filter(record => !solveSet.has(record.id));
    const record = unsolved.length ? unsolved[Math.floor(Math.random() * unsolved.length)] : null;
    postMessage({ type: 'random', request: latestQuery, complete, item: record ? publicRecord(record) : null });
    return;
  }
  if (query.sort === 'newest') found.sort((a, b) => (b.yr || 0) - (a.yr || 0));
  else if (query.sort === 'easiest') found.sort((a, b) => (bandRank[a.band] ?? 4) - (bandRank[b.band] ?? 4));
  else found.sort((a, b) => a.order - b.order);
  const exact = found.findIndex(record => record.id.toLowerCase() === (query.q || '').trim().toLowerCase());
  if (exact > 0) found.unshift(found.splice(exact, 1)[0]);
  const pages = Math.max(1, Math.ceil(found.length / 10));
  const page = Math.max(1, Math.min(Number(query.page) || 1, pages));
  postMessage({
    type: 'results', request: latestQuery, total: found.length, loaded: records.length,
    complete, ready, error: loadError, page, pages, facets, cleared,
    filters: Object.fromEntries(keys.map(key => [key, query[key] || ''])),
    items: found.slice((page - 1) * 10, page * 10).map(publicRecord)
  });
}
function publicRecord({ searchText, order, ...record }) { return record; }

onmessage = async ({ data }) => {
  if (data.type === 'query') {
    query = { ...data.query }; latestQuery = data.request; changedKey = data.changed || '';
    search(); return;
  }
  if (data.type === 'random') { search(true); return; }
  if (data.type === 'practice-set') {
    if (!complete && !loadError) { postMessage({type:'practice-set',token:data.token,items:[],error:'The library is still loading.'});return; }
    const state=data.query||{},terms=(state.q||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const solved=new Set(state.solved||[]),views={saved:new Set(state.saved||[]),solved,review:new Set(state.review||[])};
    const found=records.filter(record=>keys.every(key=>!state[key]||valueOf(record,key)===String(state[key]))&&(!state.view||views[state.view]?.has(record.id))&&terms.every(term=>record.searchText.includes(term))&&(!data.unsolved||!solved.has(record.id)));
    const count=Math.min(found.length,Math.max(1,Math.min(25,Math.floor(Number(data.size)||5))));
    // Partial Fisher-Yates: unique samples, without mutating library order.
    for(let i=0;i<count;i++){const j=i+Math.floor(Math.random()*(found.length-i));[found[i],found[j]]=[found[j],found[i]];}
    postMessage({type:'practice-set',token:data.token,total:found.length,items:found.slice(0,count).map(publicRecord)});return;
  }
  if (data.type !== 'init') return;
  let cursor = 0, lastUpdate = 0;
  const failures = [];
  const run = async () => {
    while (cursor < data.shards.length) {
      const file = data.shards[cursor++];
      try {
        const response = await fetch('../data/' + file);
        if (!response.ok) throw Error(response.status);
        const batch = await response.json();
        for (const record of batch) {
          record.searchText = [record.p, record.id, record.src, record.subj, record.topic, record.competition, record.round, record.contest, record.yr].join(' ').toLowerCase();
          const rank = { BMT: -2, SMT: -1, AMC: 0, MATH: 1, AIME: 2, OlympiadBench: 3, Olympiad: 4, Forum: 5, School: 6 }[record.src] ?? 7;
          record.order = rank * 1e7 + (/\[asy\]|\.png|\.jpg|diagram|graph.*shown/i.test(record.p) ? 5e6 : 0) + (bandRank[record.band] ?? 4) * 1e5 + records.length;
          records.push(record);
        }
        if (Date.now() - lastUpdate > 180) { search(); lastUpdate = Date.now(); }
      } catch { failures.push(file); }
    }
  };
  await Promise.all(Array.from({ length: 4 }, run));
  complete = failures.length === 0;
  loadError = failures.length ? `${failures.length} index files could not load. Refresh to retry; results cover ${records.length.toLocaleString()} loaded problems.` : '';
  search();
};
