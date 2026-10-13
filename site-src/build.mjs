// Builds the public Ecoshell pages from site-src/ into static HTML at the repo root.
// Usage: node site-src/build.mjs
// - content.js : page bodies (one render function per page id)
// - menu.js    : the slide-out menu groups (left rail + phone menu)
// - site.css   : stylesheet source; written to assets/css/site.css with every selector scoped under .es
// The portal page keeps its existing dashboard markup and assets/js/portal.js; only its sign-in view and chrome change.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join, relative, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, '..');
const read = (f) => readFileSync(join(SRC, f), 'utf8');

const {P, MENU} = new Function(read('content.js') + '\n' + read('menu.js') + '\nreturn {P, MENU};')();
P.resources.t = 'Insights & Resources';

/* ---------- page files ---------- */
const URL_OVERRIDES = {'p-custom': 'products/custom-masterbatch', 'p-abcustom': 'products/antibacterial-custom'};
for (const [id, url] of Object.entries(URL_OVERRIDES)) P[id].url = url;
P.portal = {t: 'Client portal', url: 'portal', sec: 'portal'};
const urls = Object.values(P).map((p) => p.url);
const isDir = (u) => u && urls.some((x) => x.startsWith(u + '/'));
const FILE = {};
for (const [id, p] of Object.entries(P)) FILE[id] = p.url === '' ? 'index.html' : isDir(p.url) ? p.url + '/index.html' : p.url + '.html';

function href(from, toFile) {
  const r = posix.relative(posix.dirname(from), toFile) || posix.basename(toFile);
  if (r === 'index.html') return './';
  return r.endsWith('/index.html') ? r.slice(0, -'index.html'.length) : r;
}
const asset = (from, path) => posix.relative(posix.dirname(from), path);

/* ---------- link + asset rewriting ---------- */
const TEAM = new Set(['andrew-bliss', 'kyle-newell', 'doug-hardesty']);
function rewrite(html, cur) {
  const curFile = FILE[cur];
  const hasInquiry = html.includes('id="inquiry"');
  html = html.replace(/<(a|span|button)\b([^>]*)>/g, (m, tag, attrs) => {
    const go = /data-go="([^"]+)"/.exec(attrs)?.[1];
    const anchor = /data-anchor="([^"]+)"/.exec(attrs)?.[1];
    const type = /data-type="([^"]+)"/.exec(attrs)?.[1];
    if (/\bclass="(?:seg-btn)"/.test(attrs)) return m;
    if (!go && !anchor) {
      if (tag === 'a' && /class="dl"/.test(attrs) && !/href=/.test(attrs)) {
        return `<a${attrs} href="${hasInquiry ? '#inquiry' : href(curFile, FILE.contact) + '?type=Sales'}">`;
      }
      return m;
    }
    if (tag !== 'a') return m;
    let h;
    if (!go || go === cur) h = anchor ? '#' + anchor : href(curFile, FILE[cur]);
    else h = href(curFile, FILE[go]) + (type ? '?type=' + encodeURIComponent(type) : '') + (anchor ? '#' + anchor : '');
    const clean = attrs.replace(/\s*data-(go|anchor|type)="[^"]*"/g, '');
    return `<a${clean} href="${h}">`;
  });
  html = html.replace(/src="img\/logo\/([\w-]+\.png)"/g, (m, n) => `src="${asset(curFile, `assets/img/logo/${n}`)}"`);
  html = html.replace(/src="video\/([\w-]+\.mp4)"/g, (m, n) => `src="${asset(curFile, `assets/video/${n}`)}"`);
  html = html.replace(/poster="img\/([\w-]+)\.jpg"/g, (m, n) => `poster="${asset(curFile, `assets/img/site/${n}.jpg`)}"`);
  html = html.replace(/src="img\/([\w-]+)\.jpg"/g, (m, n) =>
    `src="${asset(curFile, `assets/img/${TEAM.has(n) ? 'team' : 'site'}/${n}.jpg`)}" loading="lazy"`);
  return html;
}

/* ---------- chrome ---------- */
const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  sustainability: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  products: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  resources: '<circle cx="12" cy="5.5" r="2"/><circle cx="5.5" cy="17" r="2"/><circle cx="18.5" cy="17" r="2"/><path d="M11 7.3 6.6 15.2M13 7.3l4.4 7.9M7.5 17h9"/>',
  company: '<path d="M6 4h12v16H6z"/><path d="m12 8 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/>',
  contact: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  portal: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};
const EGG = '<svg viewBox="-2 -1 24 28" aria-hidden="true"><use href="#egg" fill="currentColor"/></svg>';
const RAIL = [['products', 'Products &amp; Services'], ['sustainability', 'Sustain&shy;ability'],['resources', 'Insights &amp; Resources'], ['company', 'Company']];
const CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const MARK = (cls = '') => `<img class="mark ${cls}" src="img/logo/${cls === 'mark--light' ? 'ecoshell-logo-white' : 'ecoshell-logo'}.png" alt="Ecoshell" width="442" height="125">`;
const lnk = (x, cls = '') => `<a${cls ? ` class="${cls}"` : ''} data-go="${x[1]}"${x[2] ? ` data-anchor="${x[2]}"` : ''}>${x[0]}</a>`;

function panes() {
  return Object.entries(MENU).map(([k, m]) =>
    `<div class="pane" data-pane="${k}" hidden><p class="panel__title">${m.t.replace('&', '&amp;')}</p>` +
    m.g.map((g) => `<h6>${g[0]}</h6>` + g[1].map((x, i) => {
      const id = `sub-${k}-${g[0].replace(/\W/g, '')}${i}`;
      return `<div class="prow">${lnk(x)}${x[3] ? `<button type="button" aria-expanded="false" aria-controls="${id}" aria-label="Show ${x[0]} products">${CHEV}</button>` : ''}</div>` +
        (x[3] ? `<ul class="psub" id="${id}" hidden>${x[3].map((y) => `<li>${lnk(y)}</li>`).join('')}</ul>` : '');
    }).join('')).join('') + '</div>').join('');
}
function phoneMenu() {
  return `<div class="mm-quick"><a data-go="contact">Contact us</a><a data-go="portal">Portal</a></div><a class="mm-home" data-go="home">Home</a>` +
    Object.entries(MENU).map(([k, m]) =>
      `<div class="mm-sec"><button type="button" aria-expanded="false">${m.t.replace('&', '&amp;')}${CHEV}</button><div class="mm-body" hidden>` +
      m.g.map((g) => `<h6>${g[0]}</h6>` + g[1].map((x) => lnk(x) + (x[3] ? x[3].map((y) => lnk(y, 'sub')).join('') : '')).join('')).join('') +
      '</div></div>').join('');
}
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

const FOOTER = `<footer class="ftr"><div class="wrap">
<div class="ftr__top">
<div class="ftr__brand"><a data-go="home" aria-label="Ecoshell home" style="text-decoration:none">${MARK('mark--light')}</a><p>Eggshell-derived materials for plastic reduction. Member of the PREVENT Waste Alliance.</p></div>
<div><h4>Products</h4><ul><li><a data-go="core-mb">Core masterbatches</a></li><li><a data-go="compostable">Compostable platform</a></li><li><a data-go="antibacterial">Antibacterial platform</a></li><li><a data-go="ecoproducts">Ecoshell products</a></li><li><a data-go="oem">OEM services</a></li></ul></div>
<div><h4>Sustainability</h4><ul><li><a data-go="sustainability">Our approach</a></li><li><a data-go="sustainability" data-anchor="lca">LCA and reduction</a></li><li><a data-go="sustainability" data-anchor="epr">EPR solutions</a></li></ul></div>
<div><h4>Company</h4><ul><li><a data-go="company">About</a></li><li><a data-go="team">Team</a></li><li><a data-go="collab">Collaboration</a></li><li><a data-go="jobs">Careers</a></li><li><a data-go="responsibility">Corporate responsibility</a></li></ul></div>
<div><h4>Contact</h4><ul><li><a data-go="contact" data-type="General">General inquiries</a></li><li><a data-go="contact" data-type="Sales">Sales</a></li><li><a data-go="contact" data-type="Co-development">Co-development</a></li><li><a data-go="contact" data-type="Press">Press</a></li><li><a data-go="resources">Resources</a></li></ul></div>
</div>
<div class="ftr__bot"><span>© ${new Date().getFullYear()} Ecoshell LLC</span><nav aria-label="Legal"><span>Privacy</span><span>Terms of use</span></nav></div>
</div></footer>`;

function shell(cur, body, {shellId = ''} = {}) {
  const sec = P[cur].sec;
  return `<div class="site"${shellId ? ` id="${shellId}"` : ''}><a class="skip" href="#content">Skip to content</a>
<header class="topbar"><div class="wrap"><button type="button" class="burger" id="burger" aria-expanded="false" aria-controls="mmenu" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10201A" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><a data-go="home" aria-label="Ecoshell home" style="text-decoration:none">${MARK()}</a><span class="topbar__tag">Bio-calcium from eggshells</span></div></header>
<div class="mobile-menu" id="mmenu" hidden><div class="wrap">${phoneMenu()}</div></div>
<div class="shell">
<aside class="lrail" aria-label="Main menu"><div class="lrail__in">
<a class="rbtn" data-go="home"${cur === 'home' ? ' aria-current="page"' : ''}>${EGG}<span>Home</span></a>
${RAIL.map(([k, label]) => `<button type="button" class="rbtn" data-panel="${k}" aria-expanded="false"${sec === k ? ' aria-current="page"' : ''}>${ic(ICONS[k])}<span>${label}</span></button>`).join('\n')}
<div class="lrail__sep" role="presentation"></div>
<a class="rbtn" data-go="contact"${sec === 'contact' ? ' aria-current="page"' : ''}>${ic(ICONS.contact)}<span>Contact Us</span></a>
<a class="rbtn" data-go="portal"${sec === 'portal' ? ' aria-current="page"' : ''}>${ic(ICONS.portal)}<span>Portal</span></a>
<div class="panel" id="panel" hidden><div class="panel__head">${MARK('mark--ghost')}<button type="button" class="panel__x" id="panelX" aria-label="Close menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5 5 19"/></svg></button></div><div class="panel__body">${panes()}</div></div>
</div></aside>
<div class="main">
<main id="content">${body}</main>
${FOOTER}
</div>
</div></div>`;
}

const DESCRIPTIONS = {
  home: 'Ecoshell turns eggshell waste into bio-calcium materials that reduce the plastic in PP and HDPE products.',
  contact: 'Contact Ecoshell for sales, samples, co-development and press inquiries.',
  portal: 'Ecoshell client portal: track samples, pilots and documents.'
};
function head(cur, extraCss = '') {
  const f = FILE[cur];
  const title = cur === 'home' ? 'Ecoshell | Eggshell-derived materials for plastic reduction' : `${P[cur].t} | Ecoshell`;
  const desc = DESCRIPTIONS[cur] || `${P[cur].t}: Ecoshell eggshell-derived materials for plastic reduction.`;
  const fav = (n) => asset(f, 'assets/img/favicon/' + n);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title.replace('&', '&amp;')}</title>
<meta name="description" content="${desc.replace('&', '&amp;')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Source+Sans+3:wght@300;400;600&display=swap">
${extraCss}<link rel="stylesheet" href="${asset(f, 'assets/css/site.css')}">
<link rel="icon" type="image/png" sizes="32x32" href="${fav('favicon-32x32.png')}">
<link rel="icon" type="image/png" sizes="16x16" href="${fav('favicon-16x16.png')}">
<link rel="shortcut icon" href="${fav('favicon.ico')}">
<link rel="apple-touch-icon" sizes="180x180" href="${fav('apple-touch-icon.png')}">
<link rel="manifest" href="${fav('site.webmanifest')}">
</head>`;
}

/* ---------- portal (keeps portal.js and its dashboard markup) ---------- */
function portalBody() {
  const orig = readFileSync(join(SRC, 'portal-dashboard.html'), 'utf8');
  const auth = `<section class="portal-auth" id="authSection"><div class="wrap">
<div><h1 class="visually-hidden">Client portal</h1>
<form class="form" id="loginForm"><h3>Sign in</h3>
<label for="loginEmail">Work email<input id="loginEmail" name="loginEmail" type="email" autocomplete="email" placeholder="name@company.com" required></label>
<label for="loginPassword">Password<input id="loginPassword" name="loginPassword" type="password" autocomplete="current-password" placeholder="At least 8 characters" minlength="8" required></label>
<div><button class="btn btn--primary" type="submit">Sign in</button></div>
<p class="portal-status" id="loginStatus" role="status" aria-live="polite"></p>
<p style="font-size:14px;color:var(--stone)">First time here? Enter your work email and a password to create your account.</p></form></div>
</div></section>`;
  return {auth, dashboard: orig};
}

/* ---------- css scoping ---------- */
function scopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '', i = 0;
  const prefix = (sel) => sel.split(',').map((s) => {
    s = s.trim();
    if (!s) return s;
    if (s === ':root' || s === 'body' || s === 'html') return scope;
    if (s.startsWith(':root')) return scope + s.slice(5);
    return `${scope} ${s}`;
  }).join(',');
  function block(stopAtBrace) {
    let res = '';
    while (i < css.length) {
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i) + 2; res += css.slice(i, e); i = e; continue; }
      if (css[i] === '}') { if (stopAtBrace) { i++; return res; } i++; continue; }
      const open = css.indexOf('{', i);
      if (open < 0) { res += css.slice(i); i = css.length; break; }
      const head = css.slice(i, open);
      const ht = head.trim();
      i = open + 1;
      if (ht.startsWith('@keyframes') || ht.startsWith('@font-face')) {
        let depth = 1, j = i;
        while (depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
        res += head + '{' + css.slice(i, j); i = j; continue;
      }
      if (ht.startsWith('@')) { res += head + '{' + block(true) + '}'; continue; }
      const close = css.indexOf('}', i);
      res += head.replace(ht, prefix(ht)) + '{' + css.slice(i, close) + '}';
      i = close + 1;
    }
    return res;
  }
  out = block(false);
  return out;
}

/* ---------- write ---------- */
function write(file, html) {
  const p = join(ROOT, file);
  mkdirSync(dirname(p), {recursive: true});
  writeFileSync(p, html);
}
const SCRIPT = (f) => `<script src="${asset(f, 'assets/js/site.js')}"></script>`;

for (const id of Object.keys(P)) {
  if (id === 'portal') continue;
  const f = FILE[id];
  const html = `${head(id)}
<body class="es">
${DEFS}
${shell(id, P[id].r())}
${SCRIPT(f)}
</body>
</html>
`;
  write(f, rewrite(html, id));
}

{
  const f = FILE.portal;
  const {auth, dashboard} = portalBody();
  const html = `${head('portal', `<link rel="stylesheet" href="assets/css/styles.css">\n`)}
<body>
${DEFS}
<div class="es">${shell('portal', auth, {shellId: 'siteHeader'})}</div>
${dashboard}
${SCRIPT(f)}
<script src="assets/js/portal.js"></script>
</body>
</html>
`;
  write(f, rewrite(html, 'portal'));
}

// Old addresses forward to their new pages.
const MOVED = {'solutions.html': 'products', 'insights.html': 'resources', 'about.html': 'company'};
for (const [old, id] of Object.entries(MOVED)) {
  const to = href(old, FILE[id]);
  write(old, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved | Ecoshell</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"></head><body><p>This page has moved to <a href="${to}">${P[id].t}</a>.</p></body></html>\n`);
}

// Stylesheet and search index.
write('assets/css/site.css', '/* Generated from site-src/site.css by site-src/build.mjs. Edit the source, not this file. */\n' + scopeCss(read('site.css'), '.es'));
console.log('Built', Object.keys(P).length, 'pages');
