const API = '/api/posts';
const $ = (id) => document.getElementById(id);
let editingId = null;
let all = [];
let categories = [];
let current = 'Todas';

function setStatus(msg) { $('status').textContent = msg || ''; }

async function api(url, opts) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Erro ${r.status}`);
  return r.status === 204 ? null : r.json();
}

function renderTabs() {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  for (const name of ['Todas', ...categories]) {
    const n = name === 'Todas' ? all.length : all.filter((p) => p.category === name).length;
    const b = document.createElement('button');
    b.textContent = `${name} (${n})`;
    if (name === current) b.className = 'on';
    b.onclick = () => { current = name; render(); };
    tabs.append(b);
  }
}

function render() {
  renderTabs();
  const q = $('search').value.trim().toLowerCase();
  const list = all.filter((p) =>
    (current === 'Todas' || p.category === current) &&
    (!q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)));
  $('count').textContent = `${list.length} seção(ões)`;
  const box = $('posts');
  box.innerHTML = '';
  if (!list.length) box.innerHTML = '<p class="muted">Nenhuma seção encontrada.</p>';
  for (const p of list) {
    const el = document.createElement('article');
    el.className = 'post' + (p.category === 'Contêineres' ? ' cont' : '');
    const badge = document.createElement('span'); badge.className = 'pill'; badge.textContent = p.category;
    const h = document.createElement('h3'); h.textContent = p.title;
    const c = document.createElement('p'); c.textContent = p.content;
    const s = document.createElement('small');
    s.textContent = new Date(p.created_at).toLocaleString('pt-BR');
    const a = document.createElement('div'); a.className = 'actions';
    const e = document.createElement('button'); e.textContent = 'Editar'; e.className = 'sec';
    e.onclick = () => startEdit(p);
    const d = document.createElement('button'); d.textContent = 'Excluir'; d.className = 'del';
    d.onclick = () => remove(p.id);
    a.append(e, d);
    el.append(badge, h, c, s, a);
    box.append(el);
  }
}

async function load() {
  try {
    setStatus('');
    if (!categories.length) {
      categories = await api('/api/categories');
      $('category').innerHTML = categories.map((c) => `<option>${c}</option>`).join('');
    }
    all = await api(API);
    render();
  } catch (err) { setStatus('Falha ao carregar: ' + err.message); }
}

function startEdit(p) {
  editingId = p.id;
  $('category').value = p.category;
  $('title').value = p.title;
  $('content').value = p.content;
  $('form-title').textContent = 'Editar seção #' + p.id;
  $('cancel').hidden = false;
  $('form-box').open = true;
  $('form-box').scrollIntoView({ behavior: 'smooth' });
}

function reset() {
  editingId = null;
  $('form').reset();
  $('form-title').textContent = '+ Nova seção';
  $('cancel').hidden = true;
  $('form-box').open = false;
}

async function remove(id) {
  if (!confirm('Excluir esta seção?')) return;
  try { await api(`${API}/${id}`, { method: 'DELETE' }); load(); }
  catch (err) { setStatus(err.message); }
}

$('cancel').onclick = reset;
$('search').oninput = render;
$('form').onsubmit = async (ev) => {
  ev.preventDefault();
  const body = JSON.stringify({
    category: $('category').value, title: $('title').value, content: $('content').value,
  });
  try {
    if (editingId) await api(`${API}/${editingId}`, { method: 'PUT', body });
    else await api(API, { method: 'POST', body });
    reset(); load();
  } catch (err) { setStatus(err.message); }
};

async function checkApi() {
  const el = $('apistatus');
  try {
    const r = await fetch('/api/health');
    if (!r.ok) throw new Error();
    el.textContent = 'API online · banco conectado';
    el.className = 'status ok';
  } catch {
    el.textContent = 'API indisponível';
    el.className = 'status erro';
  }
}

checkApi();
load();
