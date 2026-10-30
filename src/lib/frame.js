// The page frame around <main>: <head>, top bar, left rail with its slide-out menus, phone menu and footer,
// built from the Storyblok Site settings story (fields fall back to site-defaults.json). The markup matches
// site-src/build.mjs so assets/css/site.css and assets/js/site.js work unchanged. Pure functions, like blocks.js.
import DEFAULTS from './site-defaults.json';
import {str, esc, linkUrl, assetUrl} from './blocks.js';

const list = (v) => (Array.isArray(v) ? v : []);
// A settings field, or its default when the editor left it empty.
const pick = (s, key) => {
  const v = s?.[key];
  const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !v.filename && !v._file);
  return empty ? DEFAULTS[key] : v;
};
const href = (l) => (linkUrl(l) ? ` href="${esc(linkUrl(l))}"` : '');
const plain = (v) => str(v).replace(/­/g, '');

const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  sustainability: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  products: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  resources: '<circle cx="12" cy="5.5" r="2"/><circle cx="5.5" cy="17" r="2"/><circle cx="18.5" cy="17" r="2"/><path d="M11 7.3 6.6 15.2M13 7.3l4.4 7.9M7.5 17h9"/>',
  company: '<path d="M6 4h12v16H6z"/><path d="m12 8 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/>',
  contact: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  portal: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'
};
const EGG = '<svg viewBox="-2 -1 24 28" aria-hidden="true"><use href="#egg" fill="currentColor"/></svg>';
const icon = (name) => (name === 'home' ? EGG : ic(ICONS[name] || ICONS.doc));
const CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<path id="egg" d="M10 .8C4.6.8.8 9.2.8 15.6a9.2 9.2 0 0 0 18.4 0C19.2 9.2 15.4.8 10 .8Z"/>
<g id="i-material"><path d="M12 3C9.6 6.2 5 10.5 5 14.5a7 7 0 0 0 14 0C19 10.5 14.4 6.2 12 3Z"/><path d="M8.5 14.5a3.5 3.5 0 0 0 3.5 3.5"/></g>
<g id="i-manufacturing"><path d="M3 6h6v4a2 2 0 0 0 0 4v4H3V6ZM21 6h-6v4a2 2 0 0 1 0 4v4h6V6ZM3 8h-1m1 8h-1m19-8h1m-1 8h1M9 4h6m-6 16h6"/></g>
<g id="i-packaging"><rect x="5" y="4" width="14" height="4" rx="1.5"/><path d="M6 8v2l-1 2v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6l-1-2V8M5 12h14"/></g>
<g id="i-custom"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></g>
<g id="i-leaf"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/></g>
<g id="i-shield"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></g>
<g id="i-doc"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></g>
</defs></svg>`;

function mark(s, onDark = false) {
  const logo = pick(s, onDark ? 'logo_on_dark' : 'logo');
  const [w, h] = (/\/(\d+)x(\d+)\//.exec(logo?.filename || '') || [0, 442, 125]).slice(1);
  return `<img class="mark${onDark ? ' mark--light' : ' '}" src="${esc(assetUrl(logo, 900))}" alt="${esc(logo?.alt || 'Ecoshell')}" width="${w}" height="${h}">`;
}
const lnk = (x, cls = '') => `<a${cls ? ` class="${cls}"` : ''}${href(x.link)}>${esc(x.label)}</a>`;

// Which rail button lights up: the item with a "highlight" address (comma-separate several) that the current path is under.
function current(rail, path) {
  if (path === '/') return rail.findIndex((r) => r.icon === 'home');
  let best = -1, len = 0;
  rail.forEach((r, i) => {
    for (const h of str(r.highlight).split(',').map(str)) {
      if (h && h !== '/' && (path === h || path.startsWith(h.endsWith('/') ? h : h + '/') || path.replace(/\/$/, '') === h.replace(/\/$/, '')) && h.length > len) { best = i; len = h.length; }
    }
  });
  return best;
}

function rail(s, path) {
  const items = list(pick(s, 'rail'));
  const cur = current(items, path);
  const panels = items.map((r, i) => ({r, i, key: `m${i}`})).filter((x) => list(x.r.groups).length);
  const title = (r) => esc(plain(r.panel_title) || plain(r.label));

  const panes = panels.map(({r, key}) =>
    `<div class="pane" data-pane="${key}" hidden><p class="panel__title">${title(r)}</p>` +
    list(r.groups).map((g) => `<h6>${esc(g.heading)}</h6>` + list(g.links).map((x, i) => {
      const subs = list(x.sublinks);
      const id = `sub-${key}-${str(g.heading).replace(/\W/g, '')}${i}`;
      return `<div class="prow">${lnk(x)}${subs.length ? `<button type="button" aria-expanded="false" aria-controls="${id}" aria-label="Show ${esc(x.label)} products">${CHEV}</button>` : ''}</div>` +
        (subs.length ? `<ul class="psub" id="${id}" hidden>${subs.map((y) => `<li>${lnk(y)}</li>`).join('')}</ul>` : '');
    }).join('')).join('') + '</div>').join('');

  const buttons = items.map((r, i) => {
    const sel = i === cur ? ' aria-current="page"' : '';
    const sep = r.divider ? '<div class="lrail__sep" role="presentation"></div>\n' : '';
    if (list(r.groups).length) return `${sep}<button type="button" class="rbtn" data-panel="m${i}" aria-expanded="false"${sel}>${icon(r.icon)}<span>${esc(r.label)}</span></button>`;
    return `${sep}<a class="rbtn"${href(r.link)}${sel}>${icon(r.icon)}<span>${esc(r.label)}</span></a>`;
  }).join('\n');

  const quick = items.filter((r) => !list(r.groups).length && r.icon !== 'home');
  const home = items.find((r) => r.icon === 'home');
  const phone = `<div class="mm-quick">${quick.map((r) => `<a${href(r.link)}>${esc(plain(r.phone_label) || plain(r.label))}</a>`).join('')}</div>` +
    (home ? `<a class="mm-home"${href(home.link)}>${esc(home.label)}</a>` : '') +
    panels.map(({r}) => `<div class="mm-sec"><button type="button" aria-expanded="false">${title(r)}${CHEV}</button><div class="mm-body" hidden>` +
      list(r.groups).map((g) => `<h6>${esc(g.heading)}</h6>` + list(g.links).map((x) => lnk(x) + list(x.sublinks).map((y) => lnk(y, 'sub')).join('')).join('')).join('') +
      '</div></div>').join('');

  return {phone, aside: `<aside class="lrail" aria-label="Main menu"><div class="lrail__in">\n${buttons}\n` +
    `<div class="panel" id="panel" hidden><div class="panel__head"><button type="button" class="panel__x" id="panelX" aria-label="Close menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5 5 19"/></svg></button></div><div class="panel__body">${panes}</div></div>\n</div></aside>`};
}

function footer(s) {
  const cols = list(pick(s, 'footer_columns')).map((c) => `<div><h4>${esc(c.heading)}</h4><ul>${list(c.links).map((x) => `<li>${lnk(x)}</li>`).join('')}</ul></div>`).join('\n');
  const legal = list(pick(s, 'legal_links')).map((x) => (linkUrl(x.link) ? lnk(x) : `<span>${esc(x.label)}</span>`)).join('');
  return `<footer class="ftr"><div class="wrap">
<div class="ftr__top">
<div class="ftr__brand"><a href="/" aria-label="Ecoshell home" style="text-decoration:none">${mark(s, true)}</a><p>${esc(pick(s, 'footer_text'))}</p></div>
${cols}
</div>
<div class="ftr__bot"><span>© ${new Date().getFullYear()} ${esc(pick(s, 'copyright'))}</span><nav aria-label="Legal">${legal}</nav></div>
</div></footer>`;
}

// Brand colours, spacing and optional uploaded fonts, as overrides of the stylesheet's variables.
const COLORS = {color_deep: '--deep', color_ink: '--ink', color_green: '--green', color_green_lift: '--green-lift', color_lime: '--lime',
  color_eggshell: '--eggshell', color_mist: '--mist', color_stone: '--stone', color_line: '--line'};
const SPACING = {compact: 0.75, standard: 1, roomy: 1.25};
function design(s) {
  const vars = [];
  for (const [field, v] of Object.entries(COLORS)) {
    const c = str(s?.[field]);
    if (/^#[0-9a-f]{6}$/i.test(c) && c.toLowerCase() !== str(DEFAULTS[field]).toLowerCase()) {
      vars.push(`${v}:${c}`);
      if (field === 'color_ink') vars.push(`--text:${c}`);  // body text follows the ink colour
    }
  }
  if (SPACING[s?.spacing] && s.spacing !== 'standard') vars.push(`--space:${SPACING[s.spacing]}`);
  let faces = '';
  for (const [kind, v, fallback] of [['heading', '--f-display', '"Jost","Futura","Century Gothic",system-ui,sans-serif'], ['body', '--f-body', '"Source Sans 3","Segoe UI",Helvetica,Arial,sans-serif']]) {
    const file = s?.[`${kind}_font`]?.filename;
    if (!file) continue;
    const name = `Site ${kind}`;
    faces += `@font-face{font-family:"${name}";src:url("${esc(file)}");font-weight:100 900;font-style:normal;font-display:swap}`;
    vars.push(`${v}:"${name}",${fallback}`);
  }
  return vars.length || faces ? `<style>${faces}${vars.length ? `.es{${vars.join(';')}}` : ''}</style>\n` : '';
}

function favicons(s) {
  const f = s?.favicon?.filename;
  if (!f) {
    return '<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/assets/img/favicon/favicon-16x16.png">\n' +
      '<link rel="shortcut icon" href="/assets/img/favicon/favicon.ico">\n<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/favicon/apple-touch-icon.png">\n';
  }
  return `<link rel="icon" type="image/png" sizes="32x32" href="${esc(f)}/m/32x32">\n<link rel="icon" type="image/png" sizes="16x16" href="${esc(f)}/m/16x16">\n` +
    `<link rel="apple-touch-icon" sizes="180x180" href="${esc(f)}/m/180x180">\n`;
}

// The whole page. `editable` is an optional Visual Editor marker for the settings story, placed on the
// tagline; the Worker passes none, as Site settings are edited by admins from the Content list.
export function renderPage({settings, path, title, description, body, editable = ''}) {
  const s = settings || {};
  const r = rail(s, path);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="/assets/css/site.css">
${design(s)}${favicons(s)}<link rel="manifest" href="/assets/img/favicon/site.webmanifest">
</head>
<body class="es">
${DEFS}
<div class="site"><a class="skip" href="#content">Skip to content</a>
<header class="topbar"><div class="wrap"><button type="button" class="burger" id="burger" aria-expanded="false" aria-controls="mmenu" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10201A" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><a href="/" aria-label="Ecoshell home" style="text-decoration:none">${mark(s)}</a>${editable}<span class="topbar__tag">${esc(pick(s, 'tagline'))}</span></div></header>
<div class="mobile-menu" id="mmenu" hidden><div class="wrap">${r.phone}</div></div>
<div class="shell">
${r.aside}
<div class="main">
<main id="content">${body}</main>
${footer(s)}
</div>
</div></div>
<script src="/assets/js/site.js"></script>
</body>
</html>
`;
}
