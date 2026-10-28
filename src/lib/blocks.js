// Renders Storyblok Page blocks to the same markup site-src/content.js builds, so the static
// stylesheet and assets/js/site.js work unchanged. Pure functions: no Worker APIs, so the same
// file also runs in a browser for checking output against the static pages.
//
// Editor text conventions (same as the product pages):
//   [text]  shows as a placeholder still to be written
//   {text}  shows as a review flag, e.g. {Proof}; {} alone shows "Confirm"
//   a blank line starts a new paragraph in long text fields

const str = (v) => String(v ?? '').trim();
const esc = (v) => str(v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export function fmt(v, {placeholders = true} = {}) {
  let s = esc(v);
  if (placeholders) s = s.replace(/\[([^\]]*)\]/g, '<span class="ph">[$1]</span>');
  return s
    .replace(/\{([^}]*)\}/g, (m, t) => `<span class="flag">${t || 'Confirm'}</span>`)
    .replace(/CaCO3/g, 'CaCO<sub>3</sub>')
    .replace(/\n/g, '<br>');
}
const paras = (v) => str(v).split(/\n\s*\n/).map(str).filter(Boolean);
const lines = (v) => str(v).split('\n').map(str).filter(Boolean);
const list = (v) => (Array.isArray(v) ? v : []);
const attr = (v) => esc(v);

export function linkUrl(l) {
  if (!l) return '';
  if (typeof l === 'string') return l;
  const anchor = l.anchor ? '#' + l.anchor : '';
  if (l.linktype === 'story') {
    const slug = l.story?.full_slug || l.cached_url || '';
    return (slug === 'home' || slug === '' ? '/' : '/' + slug.replace(/^\//, '')) + anchor;
  }
  if (l.linktype === 'email') return l.email ? 'mailto:' + l.email : '';
  if (l.linktype === 'asset') return l.url || '';
  return (l.url || l.cached_url || '') + anchor;
}
const href = (l) => (linkUrl(l) ? ` href="${attr(linkUrl(l))}"` : '');

// Storyblok asset URLs carry the size (/f/<space>/<w>x<h>/...); only shrink, never upscale.
export function assetUrl(a, maxWidth = 1600) {
  const f = typeof a === 'string' ? a : a?.filename;
  if (!f) return '';
  if (!/\/\/a\.storyblok\.com\//.test(f) || /\.(mp4|webm|mov|pdf)$/i.test(f)) return f;
  const w = Number(/\/(\d+)x\d+\//.exec(f)?.[1] || 0);
  return `${f}/m/${w > maxWidth ? maxWidth + 'x0' : ''}`;
}
const alt = (a) => attr(a?.alt);

const ICONS = ['material', 'manufacturing', 'packaging', 'custom', 'leaf', 'shield', 'doc'];
const icon = (id) => (ICONS.includes(id)
  ? `<span class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="#7FC492" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#i-${id}"/></svg></span>`
  : '');

const BG = {mist: ' sec--mist', egg: ' sec--egg', deep: ' sec--deep on-dark'};
const section = (b, inner, extra = '') =>
  `<section class="sec${BG[b.background] || ''}${extra}"${b.anchor ? ` id="${attr(b.anchor)}"` : ''}>${inner}</section>`;
const H2_SPLIT = 'font-size:clamp(28px,3cqi,38px);color:var(--deep);margin-top:10px';

function secHead(b) {
  if (!str(b.eyebrow) && !str(b.heading)) return '';
  const side = str(b.link_label) ? `<a class="arrow"${href(b.link)}>${fmt(b.link_label)}</a>` : '';
  return `<div class="sec-head"><div><span class="eyebrow">${fmt(b.eyebrow)}</span><h2>${fmt(b.heading)}</h2></div>` +
    (str(b.intro) ? `<p>${fmt(b.intro)}</p>` : '') + side + '</div>';
}

// A grid under a heading nests inside .wrap; without a heading the grid is the .wrap itself (as the static pages do).
function gridWrap(b, grid, inner) {
  const head = secHead(b);
  const [cls, style] = grid.split('" style="');
  return head
    ? `<div class="wrap">${head}<div class="${grid}">${inner}</div></div>`
    : `<div class="wrap ${cls}"${style ? ` style="${style}"` : ''}>${inner}</div>`;
}

const BTN = {
  primary: (b) => `<a class="btn btn--primary"${href(b.link)}>${fmt(b.label)}</a>`,
  outline: (b) => `<a class="btn btn--outline"${href(b.link)}>${fmt(b.label)}</a>`,
  'outline-light': (b) => `<a class="btn btn--outline" style="color:#fff"${href(b.link)}>${fmt(b.label)}</a>`,
  lime: (b) => `<a class="btn btn--lime"${href(b.link)}>${fmt(b.label)}</a>`,
  arrow: (b) => `<a class="arrow"${href(b.link)} style="align-self:center">${fmt(b.label)}</a>`
};
const buttons = (bs) => list(bs).filter((b) => str(b.label)).map((b) => (BTN[b.style] || BTN.primary)(b)).join('');

function dlist(items, style = '') {
  const rows = list(items).filter((i) => str(i.term) || str(i.text)).map((i) => {
    const link = str(i.link_label)
      ? `<dd style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>${fmt(i.text)}</span><a class="arrow"${href(i.link)}>${fmt(i.link_label)}</a></dd>`
      : `<dd>${fmt(i.text)}</dd>`;
    return `<div><dt>${fmt(i.term)}</dt>${link}</div>`;
  });
  return rows.length ? `<dl class="list"${style ? ` style="${style}"` : ''}>${rows.join('')}</dl>` : '';
}

function form(b) {
  const title = fmt(b.form_title || 'Send us a message');
  const ctx = attr(str(b.form_title || 'Send us a message').replace(/[[\]{}]/g, ''));
  const selects = list(b.selects).filter((s) => str(s.label)).map((s) =>
    `<label>${fmt(s.label)}<select data-field="${attr(s.label)}">${lines(s.options).map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`);
  // Dropdowns sit two to a row, except beside an intro column where the form is narrow.
  let rows = '';
  if (str(b.heading)) rows = selects.join('');
  else for (let i = 0; i < selects.length; i += 2) rows += `<div class="row">${selects.slice(i, i + 2).join('')}</div>`;
  return `<form class="form" data-enquiry data-context="${ctx}"><h3>${title}</h3>` +
    '<div class="row"><label>Name<input name="name" autocomplete="name" placeholder="Full name"></label><label>Company<input name="company" autocomplete="organization" placeholder="Company" required></label></div>' +
    '<div class="row"><label>Work email<input type="email" name="email" autocomplete="email" placeholder="name@company.com" required></label><label>Country<input name="country" autocomplete="country-name" placeholder="Country"></label></div>' +
    rows +
    `<label>Message<textarea name="message" required placeholder="Tell us the polymer, process and application"></textarea></label><div><button class="btn btn--primary" type="submit">${fmt(b.button_label || 'Send inquiry')}</button></div><p class="status" role="status" aria-live="polite" hidden></p></form>`;
}

const R = {};

R.hero = (b) => {
  const crumbs = list(b.crumbs).filter((c) => str(c.label));
  const trail = crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a${href(c.link)}>${fmt(c.label)}</a><span>/</span>` : `<span>${fmt(c.label)}</span>`)).join('');
  const btns = buttons(b.buttons);
  return `<section class="phero${b.dark ? ' phero--deep on-dark' : ''}"><div class="wrap"><div class="crumbs">${trail}</div>` +
    `<div><span class="eyebrow">${fmt(b.eyebrow)}</span><h1>${fmt(b.title)}</h1><p class="sub">${fmt(b.subtitle)}</p>${btns ? `<div class="btns">${btns}</div>` : ''}</div>` +
    `<img src="${attr(assetUrl(b.image))}" alt="${alt(b.image)}"></div></section>`;
};

R.home_hero = (b) => {
  const slides = list(b.slides);
  const slide = (s, i) => {
    const media = s.video?.filename
      ? `<video src="${attr(s.video.filename)}" poster="${attr(assetUrl(s.image))}" autoplay muted loop playsinline aria-hidden="true"></video>`
      : `<img src="${attr(assetUrl(s.image))}" alt="${alt(s.image)}">`;
    const readout = list(s.readout).length
      ? `<div class="readout"><b>${fmt(s.readout_title)}</b>${list(s.readout).map((r) => `<div><span>${fmt(r.term)}</span><span>${fmt(r.text)}</span></div>`).join('')}</div>`
      : '';
    return `<div class="slide" data-slide="${i}"${i ? ' hidden' : ''}>${media}<div class="wrap"><div class="txt"><span class="eyebrow">${fmt(s.eyebrow)}</span><h2>${fmt(s.heading)}</h2><p>${fmt(s.text)}</p><div class="btns" style="margin-top:6px">${buttons(s.buttons)}</div></div></div>${readout}</div>`;
  };
  const dots = slides.map((s, i) => `<button aria-label="Slide ${i + 1}" data-dot="${i}"${i ? '' : ' aria-current="true"'}></button>`).join('');
  const cols = list(b.benefits).map((c) => `<div class="col"><h3>${fmt(c.heading)}</h3><ul>${lines(c.items).map((x) => `<li>${fmt(x)}</li>`).join('')}</ul></div>`).join('');
  return `<section class="hhero"><div class="car" id="car">${slides.map(slide).join('')}</div><div class="car__dots" id="dots">${dots}</div>` +
    (cols ? `<div class="benefits"><div class="wrap">${cols}</div></div>` : '') + '</section>';
};

R.text_split = (b) => {
  const formula = str(b.formula)
    ? `<p class="formula" style="margin-top:36px">${fmt(b.formula)}</p><p style="font:400 13px/1.5 var(--f-display);color:var(--stone);letter-spacing:.06em;margin-top:8px">${fmt(b.formula_caption)}</p>`
    : '';
  const h2 = b.large_heading ? 'font-size:clamp(30px,3.4cqi,42px);color:var(--deep);margin-top:10px' : H2_SPLIT;
  const left = `<div><span class="eyebrow">${fmt(b.eyebrow)}</span><h2 style="${h2}">${fmt(b.heading)}</h2><hr class="rule">${formula}</div>`;
  const body = paras(b.body).map((p) => `<p>${fmt(p)}</p>`).join('');
  const prose = str(b.lead) || body;
  const note = str(b.note) ? `<div class="note-box" style="margin-top:20px">${fmt(b.note)}</div>` : '';
  const link = str(b.link_label) ? `<p style="margin-top:20px"><a class="arrow"${href(b.link)}>${fmt(b.link_label)}</a></p>` : '';
  const right = prose
    ? `<div class="prose">${str(b.lead) ? `<p class="lead">${fmt(b.lead)}</p>` : ''}${body}${dlist(b.items, 'margin-top:20px')}${note}${link}</div>`
    : `<div>${dlist(b.items)}${note}${link}</div>`;
  return section(b, `<div class="wrap split${b.centered ? ' split--center' : ''}">${left}${right}</div>`);
};

R.image_split = (b) => {
  const btns = buttons(b.buttons);
  return section(b, `<div class="wrap split split--center"><img src="${attr(assetUrl(b.image))}" alt="${alt(b.image)}"><div><span class="eyebrow">${fmt(b.eyebrow)}</span><h2 style="${H2_SPLIT}">${fmt(b.heading)}</h2><p style="color:var(--muted);margin-top:14px">${fmt(b.text)}</p>${btns ? `<div class="btns">${btns}</div>` : ''}</div></div>`);
};

const GRID = {2: 'grid g2', 3: 'grid g3', 4: 'grid g4', auto: 'grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))'};
R.cards = (b) => {
  const cards = list(b.items).filter((c) => str(c.title)).map((c) => {
    const tag = linkUrl(c.link) ? 'a' : 'div';
    const arrow = str(c.link_label) ? `<span class="arrow">${fmt(c.link_label)}</span>` : '';
    if (c.image?.filename) {
      return `<${tag} class="card card--img"${href(c.link)}><img src="${attr(assetUrl(c.image, 900))}" alt="${alt(c.image)}"><div class="body">${str(c.tag) ? `<span class="tag">${fmt(c.tag)}</span>` : ''}<h3>${fmt(c.title)}</h3>${str(c.text) ? `<p>${fmt(c.text)}</p>` : ''}${arrow}</div></${tag}>`;
    }
    return `<${tag} class="card"${href(c.link)}>${icon(c.icon)}<h3${b.small_titles ? ' style="font-size:19px"' : ''}>${fmt(c.title)}</h3>${str(c.text) ? `<p>${fmt(c.text)}</p>` : ''}${arrow}</${tag}>`;
  }).join('');
  return section(b, gridWrap(b, GRID[b.columns] || GRID[3], cards));
};

R.steps = (b) => section(b, `<div class="wrap">${secHead(b)}<div class="steps">${list(b.items).filter((s) => str(s.title)).map((s) => `<div><h3>${fmt(s.title)}</h3><p>${fmt(s.text)}</p></div>`).join('')}</div>` +
  (str(b.note) ? `<p style="margin-top:24px;font-size:14.5px;color:var(--stone)">${fmt(b.note)}</p>` : '') + '</div>');

R.chips = (b) => {
  const groups = list(b.groups);
  const chips = (g) => `<div class="chips">${lines(g.items).map((x) => (g.muted ? `<span style="border-style:dashed;color:var(--stone)">${fmt(x)}</span>` : `<span>${fmt(x)}</span>`)).join('')}</div>`;
  if (groups.length === 1) return section(b, `<div class="wrap">${secHead(groups[0])}${chips(groups[0])}</div>`);
  return section(b, `<div class="wrap grid g2" style="gap:32px">${groups.map((g) => `<div><span class="eyebrow">${fmt(g.eyebrow)}</span><h2 style="font-size:clamp(26px,2.6cqi,32px);color:var(--deep);margin:10px 0 20px">${fmt(g.heading)}</h2>${chips(g)}</div>`).join('')}</div>`);
};

R.table = (b) => {
  const head = str(b.header).split('|').map((h) => `<th>${fmt(h)}</th>`).join('');
  const rows = list(b.rows).map((r) => `<tr><th>${fmt(r.label)}${str(r.note) ? `<br><small style="font-weight:400;color:var(--stone)">${fmt(r.note)}</small>` : ''}</th>${lines(r.cells).map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('');
  return section(b, `<div class="wrap">${secHead(b)}<div class="table-wrap"><table${b.compare ? ' class="compare"' : ''}><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`);
};

R.stats = (b) => section({...b, background: b.background || 'deep'}, `<div class="wrap">${secHead({...b, link_label: ''})}<div class="grid g4">${list(b.items).map((s) => `<div class="stat"><b>${fmt(s.value, {placeholders: false})}</b><span>${fmt(s.label)}</span></div>`).join('')}</div>` +
  (str(b.link_label) ? `<p style="margin-top:32px"><a class="arrow"${href(b.link)}>${fmt(b.link_label)}</a></p>` : '') + '</div>');

R.badges = (b) => section(b, `<div class="wrap">${secHead(b)}<div class="grid g4">${list(b.items).map((x) => `<div class="badge"><i>${fmt(x.mark)}</i><b>${fmt(x.title)}</b><small>${fmt(x.caption)}</small></div>`).join('')}</div></div>`);

R.industries = (b) => section(b, `<div class="wrap">${secHead(b)}<div class="ind">${list(b.items).map((x) => `<div><h3>${fmt(x.term)}</h3><p>${fmt(x.text)}</p></div>`).join('')}</div></div>`);

R.logos = (b) => {
  const spans = lines(b.items).map((x) => `<span>${fmt(x)}</span>`).join('');
  return `<section class="sec--egg" style="padding-block:56px 64px"${b.anchor ? ` id="${attr(b.anchor)}"` : ''}><div class="wrap"><div class="sec-head" style="margin-bottom:24px"><div><span class="eyebrow">${fmt(b.eyebrow)}</span><h2 style="font-size:clamp(26px,2.6cqi,32px)">${fmt(b.heading)}</h2></div>${str(b.intro) ? `<p style="font-size:14.5px">${fmt(b.intro)}</p>` : ''}</div></div><div class="marquee"><div class="marquee__track">${spans}${spans}</div></div></section>`;
};

R.definition_list = (b) => section(b, `<div class="wrap">${secHead(b)}${dlist(b.items)}${str(b.footer) ? `<p style="margin-top:24px;color:var(--muted)">${fmt(b.footer)}</p>` : ''}</div>`);

R.people = (b) => section(b, gridWrap(b, 'grid g3" style="gap:32px', list(b.items).filter((p) => str(p.name)).map((p) =>
  `<div class="person"><img src="${attr(assetUrl(p.photo, 900))}" alt="${attr(p.name)}"><span class="role">${fmt(p.role)}</span><h3>${fmt(p.name)}</h3><p>${fmt(p.bio)}</p><div style="display:flex;gap:16px"><a class="arrow"${href(p.linkedin)}>LinkedIn</a></div></div>`).join('')));

R.downloads = (b) => section(b, gridWrap(b, 'grid g3" style="gap:32px', list(b.groups).map((g) =>
  `<div class="side"><span class="eyebrow">${fmt(g.eyebrow)}</span>${list(g.items).filter((d) => str(d.title)).map((d) =>
    `<a class="dl" href="${attr(d.file?.filename || '/contact?type=Sales')}"><i>PDF</i><div><b>${fmt(d.title)}</b><small>${fmt(d.caption)}</small></div></a>`).join('')}</div>`).join('')));

R.cta = (b) => {
  const btns = list(b.buttons).length ? buttons(b.buttons)
    : '<a class="btn btn--primary" href="/contact?type=Sales">Request a sample</a><a class="btn btn--outline" href="/contact?type=General">Contact us</a>';
  return `<section class="sec sec--egg"${b.anchor ? ` id="${attr(b.anchor)}"` : ''}><div class="wrap" style="display:flex;flex-wrap:wrap;gap:24px 48px;align-items:center;justify-content:space-between"><div><h2 style="font-size:clamp(28px,3cqi,38px);color:var(--deep);max-width:24ch">${fmt(b.heading)}</h2><p style="color:var(--muted);margin-top:10px">${fmt(b.text)}</p></div><div class="btns" style="margin:0">${btns}</div></div></section>`;
};

R.inquiry_form = (b) => {
  if (str(b.heading)) {
    return section(b, `<div class="wrap gate"><div><span class="eyebrow">${fmt(b.eyebrow)}</span><h2 style="font-size:clamp(28px,3cqi,40px);margin-top:10px">${fmt(b.heading)}</h2>` +
      `${str(b.text) ? `<p style="margin-top:16px;max-width:50ch">${fmt(b.text)}</p>` : ''}${dlist(b.items, 'margin-top:26px')}</div>` +
      `<div style="color:var(--ink)">${form(b)}${str(b.form_note) ? `<p style="font-size:14px;color:var(--on-dark);margin-top:10px">${fmt(b.form_note)}</p>` : ''}</div></div>`);
  }
  return section(b, `<div class="wrap gate"><div>${form(b)}</div><div class="side">${str(b.side_note) ? `<div class="note-box">${fmt(b.side_note)}</div>` : ''}</div></div>`);
};

R.contact_form = (b) => {
  const types = lines(b.types);
  const first = types[0] || 'General';
  const selects = list(b.selects).filter((s) => str(s.label)).map((s) =>
    `<label>${fmt(s.label)}<select data-field="${attr(s.label)}">${lines(s.options).map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`).join('');
  const f = `<form class="form" data-enquiry data-context="${attr(first)} inquiry"><h3><span id="ctitle">${esc(first)} inquiry</span></h3>` +
    '<div class="row"><label>Name<input name="name" autocomplete="name" placeholder="Full name"></label><label>Company<input name="company" autocomplete="organization" placeholder="Company" required></label></div>' +
    '<div class="row"><label>Work email<input type="email" name="email" autocomplete="email" placeholder="name@company.com" required></label><label>Country<input name="country" autocomplete="country-name" placeholder="Country"></label></div>' +
    (selects ? `<div class="row">${selects}</div>` : '') +
    `<label>Message<textarea name="message" required placeholder="Tell us the polymer, process and application"></textarea></label><div><button class="btn btn--primary" type="submit">${fmt(b.button_label || 'Send')}</button></div><p class="status" role="status" aria-live="polite" hidden></p></form>`;
  const contacts = list(b.contacts).filter((c) => str(c.term)).map((c) => `<div><dt>${fmt(c.term)}</dt><dd>${fmt(c.text)}</dd></div>`).join('');
  return section(b, `<div class="wrap gate"><div><div class="seg" id="ctype" role="group" aria-label="Inquiry type">${types.map((t) => `<button type="button" aria-pressed="false" data-type="${attr(t)}">${esc(t)}</button>`).join('')}</div>` +
    `<div style="margin-top:18px" id="cform">${f}</div></div><div class="side"><span class="eyebrow">${fmt(b.contacts_eyebrow || 'Direct contacts')}</span><dl class="list">${contacts}</dl></div></div>`);
};

// Render a page's body. With draft on, each block is preceded by its Storyblok editable marker
// so the Visual Editor can outline it and open it on click.
export function renderBlocks(blocks, {draft = false} = {}) {
  return list(blocks).map((b) => {
    const render = R[b.component];
    if (!render) return '';
    return (draft && b._editable ? b._editable : '') + render(b);
  }).join('');
}

export const BLOCK_TYPES = Object.keys(R);
