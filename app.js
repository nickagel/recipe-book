const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const recipeEl = document.getElementById('recipe');
const searchRowEl = document.getElementById('search-row');
const filterToggleEl = document.getElementById('filter-toggle');
const filtersEl = document.getElementById('filters');
let recipes = [];

// Each option matches a recipe whose category or tags include any of its terms.
const FILTERS = {
  'Meal type': {
    Breakfast: ['breakfast'],
    Lunch: ['lunch'],
    Dinner: ['dinner'],
    Dessert: ['dessert'],
    'Sauce / Marinade': ['sauce', 'salsa', 'condiment', 'marinade'],
  },
  'Meat type': {
    Chicken: ['chicken'],
    Beef: ['beef', 'steak', 'ground beef'],
    Fish: ['fish', 'seafood', 'salmon', 'halibut'],
  },
  Holiday: {
    Thanksgiving: ['thanksgiving'],
    Christmas: ['christmas'],
    Birthday: ['birthday'],
  },
};

function parseCSV(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
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
    out[key] = v === 'null' || v === '~' ? '' :
      v.startsWith('[') && v.endsWith(']') ?
      v.slice(1, -1).split(',').map(unquote).filter(Boolean) :
      unquote(v);
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
    chill: meta.chill || '',
    yield: meta.yield || '',
    tags,
    images: list(meta.images).map(f => `${base}images/${encodeURIComponent(f)}`),
    measurements: parseCSV(measurements).map(r => r.join(' ').trim()),
    instructions: parseCSV(instructions).map(r => r.join(' ').trim()),
  };
  recipe.haystack = [recipe.title, recipe.description, recipe.category, ...tags, ...recipe.measurements]
    .join(' ').toLowerCase();
  recipe.labels = new Set([recipe.category, ...tags].map(s => s.toLowerCase()));
  return recipe;
}

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  Object.assign(node, attrs);
  return node;
}

function metaLine(r) {
  const p = el('p', '', {
    className: 'meta'
  });
  if (r.category) p.append(el('span', r.category, {
    className: 'category'
  }));
  r.tags.forEach(t => p.append(el('span', t, {
    className: 'tag'
  })));
  return p;
}

function renderFilters() {
  Object.entries(FILTERS).forEach(([group, options]) => {
    const fieldset = el('fieldset');
    fieldset.append(el('legend', group));
    Object.keys(options).forEach(option => {
      const label = el('label', '', {
        className: 'filter-chip'
      });
      label.append(el('input', '', {
        type: 'checkbox',
        name: group,
        value: option
      }), el('span', option));
      fieldset.append(label);
    });
    filtersEl.append(fieldset);
  });
  filtersEl.append(el('button', 'Clear filters', {
    type: 'reset',
    className: 'filter-clear'
  }));
}

// Options OR together within a group; groups AND together.
function activeFilters() {
  const data = new FormData(filtersEl);
  return Object.entries(FILTERS)
    .map(([group, options]) => data.getAll(group).flatMap(o => options[o]))
    .filter(terms => terms.length);
}

function renderList() {
  const terms = searchEl.value.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = activeFilters();
  const selected = [...new FormData(filtersEl).keys()].length;
  filterToggleEl.textContent = selected ? `Filters (${selected})` : 'Filters';
  filterToggleEl.classList.toggle('active', selected > 0);
  const matches = recipes.filter(r => terms.every(t => r.haystack.includes(t)) &&
    groups.every(g => g.some(t => r.labels.has(t))));
  resultsEl.replaceChildren(...matches.map(r => {
    const li = el('li', '', {
      className: 'card'
    });
    const cover = el('div', '', {
      className: 'cover'
    });
    if (r.images.length) cover.append(el('img', '', {
      src: r.images[0],
      alt: '',
      loading: 'lazy'
    }));
    else cover.textContent = r.title.charAt(0);
    const body = el('div', '', {
      className: 'card-body'
    });
    body.append(el('a', r.title, {
      href: `#/${encodeURIComponent(r.slug)}`,
      className: 'card-link'
    }));
    if (r.description) body.append(el('p', r.description, {
      className: 'card-desc'
    }));
    if (r.category || r.tags.length) body.append(metaLine(r));
    li.append(cover, body);
    return li;
  }));
  if (!matches.length) resultsEl.append(el('li', 'No recipes found. Try another search!', {
    className: 'empty'
  }));
}

function renderRecipe(r) {
  const ul = el('ul', '', {
    className: 'ingredients'
  });
  r.measurements.forEach(m => {
    const label = el('label');
    label.append(el('input', '', {
      type: 'checkbox'
    }), el('span', m));
    const li = el('li');
    li.append(label);
    ul.append(li);
  });
  const ol = el('ol', '', {
    className: 'steps'
  });
  r.instructions.forEach(s => ol.append(el('li', s)));
  const back = el('p', '', {
    className: 'actions'
  });
  const share = el('button', '🔗 Share', {
    type: 'button',
    className: 'back share'
  });
  share.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      share.textContent = '✓ Link copied';
    } catch {
      share.textContent = 'Copy failed';
    }
    setTimeout(() => share.textContent = '🔗 Share', 2000);
  });
  back.append(el('a', '← All recipes', {
    href: '#',
    className: 'back'
  }), share);
  const measurementsCol = el('section', '', {
    className: 'panel'
  });
  measurementsCol.append(el('h3', 'Measurements'), ul);
  const instructionsCol = el('section', '', {
    className: 'panel'
  });
  instructionsCol.append(el('h3', 'Instructions'), ol);
  const columns = el('div', '', {
    className: 'columns'
  });
  columns.append(measurementsCol, instructionsCol);
  const times = el('div', '', {
    className: 'chips'
  });
  if (r.preheat) times.append(el('span', `🔥 Preheat ${r.preheat}`, {
    className: 'chip'
  }));
  if (r.cookTime) times.append(el('span', `⏱ ${r.cookTime}`, {
    className: 'chip'
  }));
  if (r.chill) times.append(el('span', `❄️ Chill ${r.chill}`, {
    className: 'chip'
  }));
  if (r.yield) times.append(el('span', `🍽 ${r.yield}`, {
    className: 'chip'
  }));
  recipeEl.replaceChildren(back, el('h2', r.title));
  if (r.category || r.tags.length) recipeEl.append(metaLine(r));
  if (r.description) recipeEl.append(el('p', r.description, {
    className: 'lede'
  }));
  if (times.children.length) recipeEl.append(times);
  if (r.images.length) {
    const gallery = el('div', '', {
      className: 'gallery'
    });
    r.images.forEach(src => {
      const a = el('a', '', {
        href: src,
        target: '_blank'
      });
      a.append(el('img', '', {
        src,
        alt: r.title,
        loading: 'lazy'
      }));
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
  searchRowEl.hidden = !!recipe;
  if (recipe) filtersEl.hidden = true;
  filterToggleEl.setAttribute('aria-expanded', !filtersEl.hidden);
  recipeEl.hidden = !recipe;
  document.body.classList.toggle('detail', !!recipe);
  if (recipe) renderRecipe(recipe);
  else renderList();
  window.scrollTo(0, 0);
}

async function init() {
  const progress = document.getElementById('progress');
  const slugs = await fetch('recipes/index.json').then(r => r.json());
  let loaded = 0;
  recipes = (await Promise.all(slugs.map(s => loadRecipe(s).then(r => {
    progress.style.width = `${++loaded / slugs.length * 100}%`;
    return r;
  })))).sort((a, b) => a.title.localeCompare(b.title));
  progress.classList.add('done');
  resultsEl.removeAttribute('aria-busy');
  searchEl.addEventListener('input', renderList);
  renderFilters();
  filtersEl.addEventListener('change', renderList);
  filtersEl.addEventListener('reset', () => setTimeout(renderList));
  filtersEl.addEventListener('submit', e => e.preventDefault());
  filterToggleEl.addEventListener('click', () => {
    filtersEl.hidden = !filtersEl.hidden;
    filterToggleEl.setAttribute('aria-expanded', !filtersEl.hidden);
  });
  window.addEventListener('hashchange', route);
  route();
}

init();