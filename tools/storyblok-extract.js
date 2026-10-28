// Reads the static Ecoshell pages and turns each one into Storyblok Page blocks (see src/lib/blocks.js),
// so the first version of every page in Storyblok matches the site. Run it in a browser on the site's
// origin, e.g. from the dev tools console: (await import(blobUrlOfThisFile)).extractAll()
// The result is saved as tools/storyblok-pages.json and loaded into Storyblok by tools/storyblok-setup.ps1.

export const PAGES = [
  {path: '/', slug: 'home', name: 'Home'},
  {path: '/products/', slug: 'products/', name: 'Products & services', folder: 'products'},
  {path: '/products/core-masterbatches', slug: 'products/core-masterbatches'},
  {path: '/products/compostable', slug: 'products/compostable'},
  {path: '/products/antibacterial', slug: 'products/antibacterial'},
  {path: '/products/custom-masterbatch', slug: 'products/custom-masterbatch'},
  {path: '/products/antibacterial-custom', slug: 'products/antibacterial-custom'},
  {path: '/products/oem', slug: 'products/oem'},
  {path: '/products/ecoshell-products', slug: 'products/ecoshell-products'},
  {path: '/sustainability', slug: 'sustainability'},
  {path: '/resources', slug: 'resources'},
  {path: '/company/', slug: 'company/', name: 'Company', folder: 'company'},
  {path: '/company/team', slug: 'company/team'},
  {path: '/company/collaboration', slug: 'company/collaboration'},
  {path: '/company/careers', slug: 'company/careers'},
  {path: '/company/responsibility', slug: 'company/responsibility'},
  {path: '/contact', slug: 'contact'}
];

let base = location.origin + '/';
const $ = (el, sel) => (el ? el.querySelector(sel) : null);
const $$ = (el, sel) => (el ? Array.from(el.querySelectorAll(sel)) : []);

// Back to editor text: placeholders keep their [brackets], flags become {flag}, line breaks stay.
function tx(el) {
  if (!el) return '';
  const c = el.cloneNode(true);
  $$(c, 'span.flag').forEach((f) => f.replaceWith('{' + (f.textContent.trim() === 'Confirm' ? '' : f.textContent.trim()) + '}'));
  $$(c, 'sub').forEach((s) => s.replaceWith(s.textContent));
  $$(c, 'br').forEach((b) => b.replaceWith('\n'));
  return c.textContent.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
function ln(a) {
  const h = a && a.getAttribute('href');
  if (!h) return null;
  let url = h;
  if (!h.startsWith('#')) {
    const u = new URL(h, base);
    url = u.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') + u.search + u.hash;
  }
  return {id: '', url, linktype: 'url', fieldtype: 'multilink', cached_url: url};
}
function file(src, altText = '') {
  if (!src) return null;
  return {_file: new URL(src, base).pathname.replace(/^\//, ''), alt: altText || ''};
}
const img = (el) => (el ? file(el.getAttribute('src'), el.getAttribute('alt')) : null);
const blok = (component, fields) => ({component, ...fields});
function btn(a) {
  const style = a.classList.contains('arrow') ? 'arrow'
    : a.classList.contains('btn--lime') ? 'lime'
    : a.classList.contains('btn--primary') ? 'primary'
    : (a.getAttribute('style') || '').includes('#fff') ? 'outline-light' : 'outline';
  return blok('button', {label: tx(a), link: ln(a), style});
}
const btns = (el) => $$(el, 'a').map(btn);
const bg = (s) => (s.classList.contains('sec--mist') ? 'mist' : s.classList.contains('sec--egg') ? 'egg' : s.classList.contains('sec--deep') ? 'deep' : '');
function head(s) {
  const h = $(s, '.sec-head');
  const a = $(h, ':scope > a.arrow');
  return {eyebrow: tx($(h, '.eyebrow')), heading: tx($(h, 'h2')), intro: tx($(h, ':scope > p')), link_label: tx(a), link: ln(a)};
}
const item = (term, text, extra = {}) => blok('list_item', {term, text, ...extra});
const dlItems = (dl) => $$(dl, ':scope > div').map((d) => {
  const a = $(d, 'dd a.arrow');
  const span = $(d, 'dd > span');
  return item(tx($(d, 'dt')), tx(a ? span : $(d, 'dd')), a ? {link_label: tx(a), link: ln(a)} : {});
});
const selects = (form) => $$(form, 'select').map((sel) => blok('select_field', {label: sel.dataset.field, options: $$(sel, 'option').map((o) => o.textContent.trim()).join('\n')}));

function block(s) {
  const common = {background: bg(s), anchor: s.id || ''};

  if (s.classList.contains('phero')) {
    const crumbs = Array.from($(s, '.crumbs').children)
      .filter((x) => !(x.tagName === 'SPAN' && x.textContent.trim() === '/'))
      .map((x) => blok('crumb', {label: tx(x), link: x.tagName === 'A' ? ln(x) : null}));
    return blok('hero', {crumbs, eyebrow: tx($(s, '.eyebrow')), title: tx($(s, 'h1')), subtitle: tx($(s, 'p.sub')),
      buttons: btns($(s, '.btns')), image: img($(s, '.wrap > img')), dark: s.classList.contains('phero--deep')});
  }
  if (s.classList.contains('hhero')) {
    const slides = $$(s, '.slide').map((sl) => {
      const v = $(sl, 'video');
      const ro = $(sl, '.readout');
      return blok('slide', {
        image: v ? file(v.getAttribute('poster')) : img($(sl, ':scope > img')), video: v ? file(v.getAttribute('src')) : null,
        eyebrow: tx($(sl, '.txt .eyebrow')), heading: tx($(sl, '.txt h2')), text: tx($(sl, '.txt p')), buttons: btns($(sl, '.txt .btns')),
        readout_title: tx($(ro, 'b')), readout: $$(ro, ':scope > div').map((d) => item(tx(d.children[0]), tx(d.children[1])))
      });
    });
    const benefits = $$(s, '.benefits .col').map((c) => blok('benefit_column', {heading: tx($(c, 'h3')), items: $$(c, 'li').map(tx).join('\n')}));
    return blok('home_hero', {slides, benefits});
  }
  if ($(s, '.marquee')) {
    const spans = $$(s, '.marquee__track span').map(tx);
    return blok('logos', {...head(s), items: spans.slice(0, spans.length / 2).join('\n'), anchor: s.id || ''});
  }
  if ($(s, '.ind')) return blok('industries', {...common, ...head(s), items: $$(s, '.ind > div').map((d) => item(tx($(d, 'h3')), tx($(d, 'p'))))});
  if ($(s, '.gate')) {
    const gate = $(s, '.gate');
    const f = $(gate, 'form');
    if ($(s, '#ctype')) {
      return blok('contact_form', {...common, types: $$(s, '#ctype button').map((b) => b.textContent.trim()).join('\n'), selects: selects(f),
        button_label: tx($(f, 'button[type=submit]')), contacts_eyebrow: tx($(s, '.side .eyebrow')), contacts: dlItems($(s, '.side dl.list'))});
    }
    const fields = {form_title: tx($(f, 'h3')), selects: selects(f), button_label: tx($(f, 'button[type=submit]'))};
    const first = gate.children[0];
    if (!$(first, 'form')) {
      return blok('inquiry_form', {...common, ...fields, eyebrow: tx($(first, '.eyebrow')), heading: tx($(first, 'h2')), text: tx($(first, ':scope > p')),
        items: dlItems($(first, 'dl.list')), form_note: tx($(gate.children[1], ':scope > p'))});
    }
    return blok('inquiry_form', {...common, ...fields, side_note: tx($(s, '.side .note-box'))});
  }
  if ($(s, '.steps')) {
    return blok('steps', {...common, ...head(s), items: $$(s, '.steps > div').map((d) => blok('step', {title: tx($(d, 'h3')), text: tx($(d, 'p'))})), note: tx($(s, '.steps + p'))});
  }
  if ($(s, '.chips')) {
    const group = (el, eyebrow, heading) => blok('chip_group', {eyebrow, heading, items: $$(el, '.chips span').map(tx).join('\n'),
      muted: $$(el, '.chips span').some((x) => (x.getAttribute('style') || '').includes('dashed'))});
    const two = $(s, '.grid.g2');
    const groups = two ? Array.from(two.children).map((d) => group(d, tx($(d, '.eyebrow')), tx($(d, 'h2')))) : [group(s, head(s).eyebrow, head(s).heading)];
    return blok('chips', {...common, groups});
  }
  if ($(s, 'table')) {
    const t = $(s, 'table');
    const rows = $$(t, 'tbody tr').map((tr) => {
      const th = $(tr, 'th').cloneNode(true);
      const small = $(th, 'small');
      const note = tx(small);
      if (small) small.remove();
      return blok('table_row', {label: tx(th), note, cells: $$(tr, 'td').map(tx).join('\n')});
    });
    return blok('table', {...common, ...head(s), header: $$(t, 'thead th').map(tx).join(' | '), rows, compare: t.classList.contains('compare')});
  }
  if ($(s, '.stat')) {
    const a = $(s, '.wrap > p a.arrow');
    return blok('stats', {...common, ...head(s), items: $$(s, '.stat').map((d) => blok('stat', {value: tx($(d, 'b')), label: tx($(d, 'span'))})), link_label: tx(a), link: ln(a)});
  }
  if ($(s, '.badge')) return blok('badges', {...common, ...head(s), items: $$(s, '.badge').map((d) => blok('badge', {mark: tx($(d, 'i')), title: tx($(d, 'b')), caption: tx($(d, 'small'))}))});
  if ($(s, '.person')) {
    return blok('people', {...common, ...head(s), items: $$(s, '.person').map((p) => blok('person', {photo: img($(p, 'img')), name: tx($(p, 'h3')), role: tx($(p, '.role')), bio: tx($(p, ':scope > p')), linkedin: ln($(p, 'a'))}))});
  }
  if ($(s, '.side .dl')) {
    return blok('downloads', {...common, ...head(s), groups: $$(s, '.side').map((g) => blok('download_group', {eyebrow: tx($(g, '.eyebrow')),
      items: $$(g, '.dl').map((d) => blok('download', {title: tx($(d, 'b')), caption: tx($(d, 'small'))}))}))});
  }
  const split = $(s, '.split');
  if (split) {
    const [left, right] = split.children;
    if (left.tagName === 'IMG') {
      return blok('image_split', {...common, image: img(left), eyebrow: tx($(right, '.eyebrow')), heading: tx($(right, 'h2')), text: tx($(right, ':scope > p')), buttons: btns($(right, '.btns'))});
    }
    const formula = $(left, '.formula');
    const link = $(right, 'a.arrow');
    return blok('text_split', {...common, centered: split.classList.contains('split--center'),
      large_heading: ($(left, 'h2').getAttribute('style') || '').includes('42px'),
      eyebrow: tx($(left, '.eyebrow')), heading: tx($(left, 'h2')), formula: tx(formula), formula_caption: tx(formula && formula.nextElementSibling),
      lead: tx($(right, 'p.lead')), body: $$(right, ':scope > p:not(.lead)').filter((p) => !$(p, 'a.arrow')).map(tx).join('\n\n'),
      items: dlItems($(right, 'dl.list')), note: tx($(right, '.note-box')), link_label: tx(link), link: ln(link)});
  }
  const ctaWrap = $(s, '.wrap[style*="space-between"]');
  if (ctaWrap) return blok('cta', {anchor: s.id || '', heading: tx($(ctaWrap, 'h2')), text: tx($(ctaWrap, 'p')), buttons: btns($(ctaWrap, '.btns'))});
  if ($(s, '.card')) {
    const grid = $(s, '.grid');
    const columns = grid.classList.contains('g2') ? '2' : grid.classList.contains('g4') ? '4' : (grid.getAttribute('style') || '').includes('auto-fit') ? 'auto' : '3';
    const items = Array.from(grid.children).map((c) => {
      const use = $(c, 'use');
      return blok('card', {
        image: c.classList.contains('card--img') ? img($(c, 'img')) : null, tag: tx($(c, '.tag')),
        icon: use ? use.getAttribute('href').replace('#i-', '') : '', title: tx($(c, 'h3')), text: tx($(c, 'p')),
        link: c.tagName === 'A' ? ln(c) : null, link_label: tx($(c, '.arrow'))
      });
    });
    const smallTitles = $$(grid, ':scope > .card h3').some((h) => (h.getAttribute('style') || '').includes('19px'));
    return blok('cards', {...common, ...head(s), columns, small_titles: smallTitles, items});
  }
  if ($(s, 'dl.list')) {
    const dl = $(s, 'dl.list');
    return blok('definition_list', {...common, ...head(s), items: dlItems(dl), footer: tx(dl.nextElementSibling)});
  }
  return blok('unknown', {html: s.outerHTML.slice(0, 200)});
}

export function extract(doc, url) {
  base = url;
  const main = $(doc, 'main#content');
  return {
    title: (doc.title || '').replace(/ \| Ecoshell$/, '').replace(/^Ecoshell \| /, ''),
    description: $(doc, 'meta[name="description"]')?.getAttribute('content') || '',
    body: Array.from(main.children).filter((s) => s.tagName === 'SECTION').map(block)
  };
}

export async function extractAll(origin = location.origin) {
  const out = [];
  for (const p of PAGES) {
    const url = origin + p.path;
    const html = await (await fetch(url, {cache: 'no-store'})).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const page = extract(doc, url);
    out.push({...p, name: p.name || page.title, ...page});
  }
  return out;
}
