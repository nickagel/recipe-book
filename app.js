const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const recipeEl = document.getElementById('recipe');
let recipes = [];

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  // First row is the header.
  return rows.slice(1).filter(r => r.some(f => f.trim()));
}

const unquote = s => s.trim().replace(/^(['"])(.*)\1$/, '$2');

// Minimal flat YAML: `key: value`, `key: [a, b]`, or `key:` followed by `- item` lines.
function parseYAML(text) {
  const out = {};
  let key = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(unquote(item[1]));
      continue;
    }
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    const v = m[2].trim();
    out[key] = v === 'null' || v === '~' ? ''
      : v.startsWith('[') && v.endsWith(']')
      ? v.slice(1, -1).split(',').map(unquote).filter(Boolean)
      : unquote(v);
  }
  return out;
}

async function fetchText(path) {
  const res = await fetch(path);
  return res.ok ? res.text() : '';
}

async function loadRecipe(slug) {
  const base = `recipes/${encodeURIComponent(slug)}/`;
  const [desc, measurements, instructions] = await Promise.all([
    fetchText(base + 'description.yml'),
    fetchText(base + 'measurements.csv'),
    fetchText(base + 'instructions.csv'),
  ]);
  const meta = parseYAML(desc);
  const list = v => Array.isArray(v) ? v : (v ? v.split(',').map(s => s.trim()) : []);
  const tags = list(meta.tags);
  const recipe = {
    slug,
    title: meta.title || slug,
    description: meta.description || '',
    category: meta.category || '',
    preheat: meta.preheat || '',
    cookTime: meta.cook_time || '',
    tags,
    images: list(meta.images).map(f => `${base}images/${encodeURIComponent(f)}`),
    measurements: parseCSV(measurements).map(r => r.join(' ').trim()),
    instructions: parseCSV(instructions).map(r => r.join(' ').trim()),
  };
  recipe.haystack = [recipe.title, recipe.description, recipe.category, ...tags, ...recipe.measurements]
    .join(' ').toLowerCase();
  return recipe;
}

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  Object.assign(node, attrs);
  return node;
}

function metaLine(r) {
  const p = el('p', '', { className: 'meta' });
  if (r.category) p.append(el('span', r.category, { className: 'category' }));
  r.tags.forEach(t => p.append(el('span', t, { className: 'tag' })));
  return p;
}

function renderList() {
  const terms = searchEl.value.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = recipes.filter(r => terms.every(t => r.haystack.includes(t)));
  resultsEl.replaceChildren(...matches.map(r => {
    const li = el('li', '', { className: 'card' });
    const cover = el('div', '', { className: 'cover' });
    if (r.images.length) cover.append(el('img', '', { src: r.images[0], alt: '', loading: 'lazy' }));
    else cover.textContent = r.title.charAt(0);
    const body = el('div', '', { className: 'card-body' });
    body.append(el('a', r.title, { href: `#/${encodeURIComponent(r.slug)}`, className: 'card-link' }));
    if (r.description) body.append(el('p', r.description, { className: 'card-desc' }));
    if (r.category || r.tags.length) body.append(metaLine(r));
    li.append(cover, body);
    return li;
  }));
  if (!matches.length) resultsEl.append(el('li', 'No recipes found. Try another search!', { className: 'empty' }));
}

function renderRecipe(r) {
  const ul = el('ul', '', { className: 'ingredients' });
  r.measurements.forEach(m => {
    const label = el('label');
    label.append(el('input', '', { type: 'checkbox' }), el('span', m));
    const li = el('li');
    li.append(label);
    ul.append(li);
  });
  const ol = el('ol', '', { className: 'steps' });
  r.instructions.forEach(s => ol.append(el('li', s)));
  const back = el('p');
  back.append(el('a', '← All recipes', { href: '#', className: 'back' }));
  const measurementsCol = el('section', '', { className: 'panel' });
  measurementsCol.append(el('h3', 'Measurements'), ul);
  const instructionsCol = el('section', '', { className: 'panel' });
  instructionsCol.append(el('h3', 'Instructions'), ol);
  const columns = el('div', '', { className: 'columns' });
  columns.append(measurementsCol, instructionsCol);
  const times = el('div', '', { className: 'chips' });
  if (r.preheat) times.append(el('span', `🔥 Preheat ${r.preheat}`, { className: 'chip' }));
  if (r.cookTime) times.append(el('span', `⏱ ${r.cookTime}`, { className: 'chip' }));
  recipeEl.replaceChildren(back, el('h2', r.title));
  if (r.category || r.tags.length) recipeEl.append(metaLine(r));
  if (r.description) recipeEl.append(el('p', r.description, { className: 'lede' }));
  if (times.children.length) recipeEl.append(times);
  if (r.images.length) {
    const gallery = el('div', '', { className: 'gallery' });
    r.images.forEach(src => {
      const a = el('a', '', { href: src, target: '_blank' });
      a.append(el('img', '', { src, alt: r.title, loading: 'lazy' }));
      gallery.append(a);
    });
    recipeEl.append(gallery);
  }
  recipeEl.append(columns);
}

function route() {
  const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const recipe = recipes.find(r => r.slug === slug);
  resultsEl.hidden = !!recipe;
  searchEl.hidden = !!recipe;
  recipeEl.hidden = !recipe;
  document.body.classList.toggle('detail', !!recipe);
  if (recipe) renderRecipe(recipe);
  else renderList();
  window.scrollTo(0, 0);
}

async function init() {
  const slugs = await fetch('recipes/index.json').then(r => r.json());
  recipes = (await Promise.all(slugs.map(loadRecipe))).sort((a, b) => a.title.localeCompare(b.title));
  searchEl.addEventListener('input', renderList);
  window.addEventListener('hashchange', route);
  route();
}

init();
