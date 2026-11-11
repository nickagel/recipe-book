const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const recipeEl = document.getElementById('recipe');
const searchRowEl = document.getElementById('search-row');
const filterToggleEl = document.getElementById('filter-toggle');
const filtersEl = document.getElementById('filters');
const toolbarEl = document.getElementById('toolbar');
const azEl = document.getElementById('az');
const azBubbleEl = el('div', '', {
  className: 'az-bubble'
});
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const lightboxImgEl = el('img');
const lightboxEl = el('dialog', '', {
  className: 'lightbox'
});
lightboxEl.append(lightboxImgEl);
lightboxEl.addEventListener('click', () => lightboxEl.close());
document.body.append(lightboxEl);
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
    measurements: parseCSV(measurements).map(r => ({
      amount: (r[0] || '').trim(),
      ingredient: r.slice(1).join(' ').trim()
    })),
    instructions: parseCSV(instructions).map(r => r.join(' ').trim()),
  };
  recipe.haystack = [recipe.title, recipe.description, recipe.category, ...tags, ...recipe.measurements.map(m => `${m.amount} ${m.ingredient}`)]
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
  const letterOf = r => r.title.normalize('NFD').charAt(0).toUpperCase();
  const groupEls = [];
  matches.forEach((r, i) => {
    if (!i || letterOf(matches[i - 1]) !== letterOf(r)) {
      const group = el('li', '', {
        className: 'group'
      });
      group.dataset.letter = letterOf(r);
      group.append(el('h2', '', {
        className: 'section'
      }));
      group.firstChild.append(el('span', letterOf(r)));
      groupEls.push(group);
    }
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
    groupEls.at(-1).append(li);
  });
  resultsEl.replaceChildren(...groupEls);
  if (!matches.length) resultsEl.append(el('li', 'No recipes found. Try another search!', {
    className: 'empty'
  }));
  updateAZ();
}

function updateAZ() {
  const present = new Set([...resultsEl.querySelectorAll('.group')].map(c => c.dataset.letter));
  azEl.hidden = !present.size;
  azEl.querySelectorAll('button').forEach(b => b.classList.toggle('off', !present.has(b.textContent)));
}

// Jumps to the first card at or after the letter, so empty letters still land somewhere sensible.
function jumpToLetter(i) {
  const sections = [...resultsEl.querySelectorAll('.group')];
  if (!sections.length) return;
  const target = sections.find(s => s.dataset.letter >= LETTERS[i]) || sections.at(-1);
  window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - toolbarEl.offsetHeight);
}

function initAZ() {
  new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-h', `${toolbarEl.getBoundingClientRect().height}px`))
    .observe(toolbarEl);
  azEl.append(azBubbleEl, ...LETTERS.map(l => el('button', l, {
    type: 'button'
  })));
  let dragging = false;
  let hideTimer;
  const select = e => {
    const r = azEl.getBoundingClientRect();
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    const i = Math.min(LETTERS.length - 1, Math.floor(y / r.height * LETTERS.length));
    azBubbleEl.textContent = LETTERS[i];
    azBubbleEl.style.top = `${y}px`;
    azBubbleEl.classList.add('show');
    clearTimeout(hideTimer);
    jumpToLetter(i);
  };
  const end = () => {
    dragging = false;
    hideTimer = setTimeout(() => azBubbleEl.classList.remove('show'), 400);
  };
  azEl.addEventListener('pointerdown', e => {
    dragging = true;
    azEl.setPointerCapture(e.pointerId);
    select(e);
  });
  azEl.addEventListener('pointermove', e => dragging && select(e));
  azEl.addEventListener('pointerup', end);
  azEl.addEventListener('pointercancel', end);
  // Keyboard activation only; pointer input is handled above.
  azEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && e.detail === 0) jumpToLetter(LETTERS.indexOf(b.textContent));
  });
}

// Scales the leading quantity of an amount like "1 1/2 cups (170g)"; text without a leading number is returned as is.
const SIZES = [{
  label: '½×',
  value: 0.5
}, {
  label: '1×',
  value: 1
}, {
  label: '2×',
  value: 2
}, ];
const CONTAINER = 'bag|can|jar|block|bottle|container|package|tin';
const QTY = /\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?/g;
const FRACTIONS = [
  [1 / 16, '1/16'],
  [1 / 8, '1/8'],
  [1 / 6, '1/6'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [5 / 6, '5/6'],
  [7 / 8, '7/8'],
];

const toNumber = t => t.trim().split(/\s+/)
  .reduce((sum, p) => sum + (p.includes('/') ? p.split('/')[0] / p.split('/')[1] : +p), 0);

function formatQty(v, decimal) {
  if (decimal) return String(v >= 10 ? Math.round(v) : +v.toFixed(2));
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  const hit = FRACTIONS.find(([f]) => Math.abs(f - frac) < 0.02);
  if (!hit) return String(+v.toFixed(2));
  return whole ? `${whole} ${hit[1]}` : hit[1];
}

function scaleNumbers(text, k) {
  return text.replace(QTY, (tok, at) => {
    // Metric quantities (including the first number of a range) and decimals stay decimal.
    const metric = /^(?:\s*[–-]\s*[\d./\s]+?)?\s*(?:kg|g|ml|dl|l)\b/i.test(text.slice(at + tok.length));
    return formatQty(toNumber(tok) * k, metric || tok.includes('.'));
  });
}

// Singular at 1 or less, plural above 1 ("1/2 cup", "1 1/2 cups"); a range follows its last number.
const COUNTED = 'cup|stick|piece|clove|steak|fillet|slice|bunch|head|recipe|crust|' + CONTAINER;

function pluralize(text) {
  return text.replace(new RegExp(`(\\d(?:[\\d./\\s–-]*\\d)?)\\s+(${COUNTED})s?\\b`, 'gi'), (m, num, word) => {
    const last = toNumber(num.match(QTY).at(-1));
    return `${num} ${word}${last > 1 ? 's' : ''}`;
  });
}

function scaleAmount(amount, k) {
  if (k === 1 || !/^\s*\d/.test(amount)) return amount;
  // A can sized by weight ("13.4 oz can") has no count to scale, so prefix a multiplier.
  if (new RegExp(`^\\d+(?:\\.\\d+)?\\s*(?:fl\\s)?(?:oz|g|ml)\\s+(?:${CONTAINER})\\b`, 'i').test(amount)) {
    return `${k === 0.5 ? '½' : k}× ${amount}`;
  }
  const open = amount.indexOf('(');
  let main = open < 0 ? amount : amount.slice(0, open);
  let rest = open < 0 ? '' : amount.slice(open);
  const container = new RegExp(`^[\\d\\s./–-]+(?:${CONTAINER})s?\\b`, 'i').test(main);
  // Parenthetical sizes describe each item ("1 can (15 oz)", "4 (6 oz each)"), not the total.
  const perItem = container || /^\s*\d+\s*$/.test(main) || /\beach\b/i.test(rest);
  main = scaleNumbers(main, k);
  if (!perItem) rest = scaleNumbers(rest, k);
  return pluralize(main + rest);
}

function renderRecipe(r) {
  const ul = el('ul', '', {
    className: 'ingredients'
  });
  const rows = [];
  r.measurements.forEach(m => {
    const label = el('label');
    const text = el('span', `${m.amount} ${m.ingredient}`.trim());
    label.append(el('input', '', {
      type: 'checkbox'
    }), text);
    rows.push({
      m,
      text
    });
    const li = el('li');
    li.append(label);
    ul.append(li);
  });
  const sizeNote = el('p', 'Amounts are scaled; instructions and times are unchanged.', {
    className: 'size-note',
    hidden: true
  });
  const sizes = el('div', '', {
    className: 'sizes'
  });
  sizes.setAttribute('role', 'group');
  sizes.setAttribute('aria-label', 'Recipe size');
  SIZES.forEach(({
    label,
    value
  }) => {
    const btn = el('button', value === 0.5 ? '' : label, {
      type: 'button'
    });
    if (value === 0.5) {
      btn.setAttribute('aria-label', 'Half size');
      const frac = el('span', '', {
        className: 'frac'
      });
      frac.append(el('span', '1'), el('span', '2'));
      btn.append(frac, '×');
    }
    btn.setAttribute('aria-pressed', value === 1);
    btn.addEventListener('click', () => {
      sizes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === btn));
      rows.forEach(({
        m,
        text
      }) => text.textContent = `${scaleAmount(m.amount, value)} ${m.ingredient}`.trim());
      sizeNote.hidden = value === 1;
    });
    sizes.append(btn);
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
  const actionsEnd = el('span', '', {
    className: 'actions-end'
  });
  if ('wakeLock' in navigator) actionsEnd.append(awakeSwitch());
  actionsEnd.append(share);
  back.append(el('a', '← All recipes', {
    href: '#',
    className: 'back'
  }), actionsEnd);
  const measurementsCol = el('section', '', {
    className: 'panel'
  });
  const measurementsHead = el('div', '', {
    className: 'panel-head'
  });
  measurementsHead.append(el('h3', 'Measurements'), sizes);
  measurementsCol.append(measurementsHead, sizeNote, ul);
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
        href: src
      });
      a.addEventListener('click', e => {
        e.preventDefault();
        lightboxImgEl.src = src;
        lightboxImgEl.alt = r.title;
        lightboxEl.showModal();
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

let listScrollY = 0;

// Keeps the screen on while a recipe is open; the browser drops the lock when the tab is hidden, so it is re-requested on return.
let keepAwake = false;
try {
  keepAwake = localStorage.getItem('keepAwake') === '1';
} catch {}
let wakeLock = null;

async function updateWakeLock() {
  const want = keepAwake && !recipeEl.hidden && document.visibilityState === 'visible';
  if (want && !wakeLock) {
    const request = navigator.wakeLock.request('screen').catch(() => null);
    wakeLock = request;
    const lock = await request;
    if (!lock) {
      if (wakeLock === request) wakeLock = null;
      return;
    }
    lock.addEventListener('release', () => {
      if (wakeLock === request) wakeLock = null;
    });
  } else if (!want && wakeLock) {
    const request = wakeLock;
    wakeLock = null;
    (await request)?.release();
  }
}

function awakeSwitch() {
  const sw = el('button', '', {
    type: 'button',
    className: 'switch'
  });
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', keepAwake);
  sw.append(el('span', '', {
    className: 'switch-track'
  }), 'Cook Mode');
  sw.addEventListener('click', () => {
    keepAwake = !keepAwake;
    sw.setAttribute('aria-checked', keepAwake);
    try {
      localStorage.setItem('keepAwake', keepAwake ? '1' : '0');
    } catch {}
    updateWakeLock();
  });
  const tip = el('span', 'Keeps your screen from going dark while you cook.', {
    className: 'tip',
    id: 'cook-tip'
  });
  tip.setAttribute('role', 'tooltip');
  const info = el('button', 'i', {
    type: 'button',
    className: 'info'
  });
  info.setAttribute('aria-label', 'What is Cook Mode?');
  info.setAttribute('aria-describedby', 'cook-tip');
  // Hover and focus show the tip via CSS; the click toggle covers touch screens.
  info.addEventListener('click', e => {
    e.stopPropagation();
    tip.classList.toggle('open');
  });
  const cook = el('span', '', {
    className: 'cook'
  });
  cook.append(sw, info, tip);
  return cook;
}

document.addEventListener('click', () => document.querySelectorAll('.tip.open').forEach(t => t.classList.remove('open')));

document.addEventListener('visibilitychange', updateWakeLock);

function route() {
  const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const recipe = recipes.find(r => r.slug === slug);
  if (recipe && !resultsEl.hidden) listScrollY = window.scrollY;
  resultsEl.hidden = !!recipe;
  searchRowEl.hidden = !!recipe;
  if (recipe) filtersEl.hidden = true;
  filterToggleEl.setAttribute('aria-expanded', !filtersEl.hidden);
  recipeEl.hidden = !recipe;
  lightboxEl.close();
  document.body.classList.toggle('detail', !!recipe);
  if (recipe) {
    renderRecipe(recipe);
    azEl.hidden = true;
  } else renderList();
  window.scrollTo(0, recipe ? 0 : listScrollY);
  updateWakeLock();
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
  initAZ();
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