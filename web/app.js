/* global fetch */
(function(){
  let graph = null; // { stats, nodes }
  let nodesArr = []; // array of nodes with key included
  let activeKey = null;

  const el = sel => document.querySelector(sel);
  const resultsEl = el('#results');
  const countEl = el('#count');
  const searchEl = el('#search');
  const catSel = el('#categoryFilter');
  const detailsEl = el('#details');
  const graphFileEl = el('#graphFile');
  const tryFetchBtn = el('#tryFetch');

  function loadGraphObject(obj){
    graph = obj;
    nodesArr = Object.entries(graph.nodes || {}).map(([k, v]) => ({ key: k, ...v }));
    buildCategoryOptions();
    renderResults();
  }

  function loadGraphFromFile(file){
    const fr = new FileReader();
    fr.onload = () => {
      try { loadGraphObject(JSON.parse(fr.result)); }
      catch(e){ alert('Invalid JSON: ' + e); }
    };
    fr.readAsText(file);
  }

  async function tryFetchDefault(){
    try {
      const res = await fetch('../research_graph.json');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      loadGraphObject(data);
    } catch (e) {
      alert('Fetch ../research_graph.json failed. Use file picker.\n' + e);
    }
  }

  function buildCategoryOptions(){
    const cats = new Set();
    for (const n of nodesArr){ if (n.category) cats.add(n.category); }
    const sorted = Array.from(cats).sort();
    catSel.innerHTML = '<option value="">All categories</option>' +
      sorted.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

  function normalizeName(n){
    if (n && n.name) return n.name;
    const key = n.key || '';
    const seg = key.split('/').pop() || key;
    return seg.replace(/_/g,' ');
  }

  function renderResults(){
    if (!graph){ resultsEl.innerHTML = ''; countEl.textContent = ''; return; }
    const q = (searchEl.value||'').trim().toLowerCase();
    const cat = catSel.value || '';
    let items = nodesArr;
    if (cat) items = items.filter(n => (n.category||'') === cat);
    if (q){
      items = items.filter(n => {
        const hay = (normalizeName(n) + ' ' + (n.key||'')).toLowerCase();
        return hay.includes(q);
      });
    }
    countEl.textContent = items.length + ' results';
    resultsEl.innerHTML = items.map(n => `
      <li data-key="${escapeHtml(n.key)}" class="${n.key===activeKey?'active':''}">
        <div>${escapeHtml(normalizeName(n))}</div>
        <div class="muted">${escapeHtml(n.key)}</div>
      </li>
    `).join('');
  }

  function onResultClick(e){
    const li = e.target.closest('li[data-key]'); if (!li) return;
    const key = li.getAttribute('data-key');
    activeKey = key;
    renderResults();
    renderDetails(key);
  }

  function renderDetails(key){
    const node = (graph && graph.nodes && graph.nodes[key]) || null;
    if (!node){ detailsEl.innerHTML = '<div class="placeholder">Node not found.</div>'; return; }
    const name = node.name || normalizeName({ key, name: node.name });
    const reqs = Array.isArray(node.requires) ? node.requires : [];
    const unlocks = Array.isArray(node.unlocks) ? node.unlocks : [];
    const costs = Array.isArray(node.costs) ? node.costs : [];
    const awards = Array.isArray(node.awards) ? node.awards : [];

    // Compute transitive prerequisites and total cost
    const { order, set } = topoOrderForTarget(key);
    // Exclude the target from prerequisites list for display, but include its own cost in totals
    const prereqOnly = order.filter(k => k !== key);
    const totalCosts = sumCosts(order);

    detailsEl.innerHTML = `
      <div class="kv">
        <div class="k">Name</div><div><strong>${escapeHtml(name)}</strong></div>
        <div class="k">Key</div><div class="muted">${escapeHtml(key)}</div>
        <div class="k">Category</div><div>${escapeHtml(node.category||'')}</div>
        ${node.icon?`<div class="k">Icon</div><div class="muted">${escapeHtml(node.icon)}</div>`:''}
        ${node.pos?`<div class="k">Position</div><div class="muted">x:${escapeHtml(String(node.pos.x??''))} y:${escapeHtml(String(node.pos.y??''))}</div>`:''}
      </div>

      <div class="group">
        <h3>Direct Requirements (${reqs.length})</h3>
        <div class="list">${reqs.map(r => linkNode(r)).join('') || '<span class="muted">None</span>'}</div>
      </div>

      <div class="group">
        <h3>Total Cost (including prerequisites)</h3>
        <div class="costs">${Object.entries(totalCosts).map(([res, amt]) => costPill(res, amt)).join('') || '<span class="muted">No costs</span>'}</div>
      </div>

      <div class="group">
        <h3>Unlock Steps (${order.length})</h3>
        <ol>
          ${order.map(k => `<li>${linkNode(k)}</li>`).join('')}
        </ol>
      </div>

      <div class="group">
        <h3>Awards</h3>
        <div class="list">${awards.map(a => `<span class="item">${escapeHtml(a)}</span>`).join('') || '<span class="muted">None</span>'}</div>
      </div>

      <div class="group">
        <h3>Direct Unlocks (${unlocks.length})</h3>
        <div class="list">${unlocks.map(u => linkNode(u)).join('') || '<span class="muted">None</span>'}</div>
      </div>
    `;

    // Bind links
    detailsEl.querySelectorAll('[data-goto]').forEach(a => {
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const k = a.getAttribute('data-goto');
        activeKey = k;
        renderResults();
        renderDetails(k);
        // scroll selected into view in list
        const li = resultsEl.querySelector(`li[data-key="${CSS.escape(k)}"]`);
        if (li) li.scrollIntoView({ block: 'center' });
      });
    });
  }

  function linkNode(key){
    const n = (graph && graph.nodes && graph.nodes[key]) || null;
    const label = n && (n.name || normalizeName({ key })) || key.split('/').pop();
    return `<a href="#" class="item" data-goto="${escapeHtml(key)}">${escapeHtml(label)}</a>`;
  }

  function sumCosts(order){
    const acc = Object.create(null);
    for (const k of order){
      const n = graph.nodes[k];
      if (!n || !Array.isArray(n.costs)) continue;
      for (const c of n.costs){
        if (!c || !c.resource) continue;
        const amt = typeof c.count === 'number' ? c.count : parseFloat(c.count);
        if (!isFinite(amt)) continue;
        acc[c.resource] = (acc[c.resource] || 0) + amt;
      }
    }
    return acc;
  }

  function topoOrderForTarget(target){
    // DFS topological order of prerequisites + target
    const visited = new Set();
    const temp = new Set();
    const order = [];
    function visit(k){
      if (visited.has(k)) return;
      if (temp.has(k)) return; // cycle guard
      temp.add(k);
      const n = graph.nodes[k];
      const reqs = (n && Array.isArray(n.requires)) ? n.requires : [];
      for (const r of reqs){ if (graph.nodes[r]) visit(r); }
      temp.delete(k);
      visited.add(k);
      order.push(k);
    }
    visit(target);
    return { order, set: visited };
  }

  // Events
  resultsEl.addEventListener('click', onResultClick);
  searchEl.addEventListener('input', renderResults);
  catSel.addEventListener('change', renderResults);
  graphFileEl.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadGraphFromFile(f);
  });
  tryFetchBtn.addEventListener('click', tryFetchDefault);
})();

