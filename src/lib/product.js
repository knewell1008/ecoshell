// The <main> of a product page from a Storyblok Product story, the same markup as productPage() in
// site-src/content.js. Any Product story in the "products" folder becomes a page at /products/<slug>.
// Empty fields fall back to what the static pages show (platform defaults for notes and certificates).
import {str, esc, fmt, assetUrl} from './blocks.js';

const list = (v) => (Array.isArray(v) ? v : []);
const ph = (t) => `<span class="ph">[${esc(t)}]</span>`;

const PLATFORMS = {
  core: {label: 'Core masterbatches', path: '/products/core-masterbatches',
    certs: [['P', 'Patent', '[Patent number]'], ['R', 'Recyclability', '[Test basis]']]},
  compostable: {label: 'Compostable platform', path: '/products/compostable',
    note: 'Compostability claims must name the standard, the certifier and the conditions (industrial or home).',
    certs: [['C', 'Compostability', '[Standard and certifier]'], ['B', 'Bio-based content', '[Certificate]']]},
  antibacterial: {label: 'Antibacterial platform', path: '/products/antibacterial',
    note: 'Public health claims (for example, "kills germs") need EPA registration. Until it is granted, copy is limited to protecting the article itself.',
    certs: [['E', 'EPA registration', 'Pending'], ['T', 'Efficacy testing', '[Lab and method]']]}
};
const COMMON_CERTS = [['S', 'Safety data', 'SDS available'], ['Q', 'Quality', '[ISO 9001 or equivalent]']];
// Platform of the original nine products, for stories made before the Platform field existed.
const KNOWN = {core: 'core', flow: 'core', expand: 'core', mold: 'core', complete: 'core', bioflex: 'compostable', bioform: 'compostable', bioshape: 'compostable', shield: 'antibacterial'};

export function productTitle(c) {
  return str(c.name).replace(/^Ecoshell /, '');
}

export function renderProduct(c, slug, {draft = false} = {}) {
  const editable = (b) => (draft && b?._editable) || '';
  const kind = PLATFORMS[c.platform] ? c.platform : KNOWN[slug] || 'core';
  const plat = PLATFORMS[kind];
  const name = str(c.name) || slug;
  const short = productTitle(c) || slug;
  const comp = kind === 'compostable';
  const summary = str(c.summary);
  const lead = str(c.description) || summary;
  const details = str(c.details).split(/\n\s*\n/).map(str).filter(Boolean);
  const note = str(c.note) || plat.note || '';
  const img = c.hero_image?.filename ? c.hero_image : {_file: 'assets/img/site/pellets.jpg'};

  let h = `${editable(c)}<section class="phero"><div class="wrap"><div class="crumbs"><a href="/">Home</a><span>/</span><a href="/products/">Products & services</a><span>/</span><a href="${plat.path}">${plat.label}</a><span>/</span><span>${esc(short)}</span></div>` +
    `<div><span class="eyebrow">${plat.label}</span><h1>${esc(name)}</h1><p class="sub">${fmt(summary)}</p><div class="btns"><a class="btn btn--primary" href="#inquiry">Make an inquiry</a><a class="btn btn--outline" href="#downloads">TDS / SDS download</a></div></div>` +
    `<img src="${esc(assetUrl(img))}" alt="${esc(img.alt)}"></div></section>`;
  h += '<div class="ptabs"><div class="wrap"><a href="#desc">Description</a><a href="#apps">Applications</a><a href="#tech">Technical information</a><a href="#certs">Certifications</a><a href="#inquiry">Inquiry</a></div></div>';

  h += `<section class="sec" id="desc"><div class="wrap split"><div><span class="eyebrow">Description</span><h2 style="font-size:clamp(28px,3cqi,38px);color:var(--deep);margin-top:10px">What it is and where it fits</h2><hr class="rule"></div><div class="prose"><p class="lead">${fmt(lead)}</p>` +
    (details.length ? details.map((p) => `<p>${fmt(p)}</p>`).join('') : `<p>${ph('Two or three sentences on what makes this grade different: the problem it solves, the processing window and the typical let-down ratio.')}</p>`) +
    (note ? `<div class="note-box" style="margin-top:18px">${fmt(note)}</div>` : '') + '</div></div></section>';

  const apps = list(c.applications).filter((a) => str(a.title));
  h += `<section class="sec sec--mist" id="apps"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Applications</span><h2>Where ${esc(short)} is used</h2></div></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))">` +
    apps.map((a) => `${editable(a)}<div class="card"><h3 style="font-size:19px">${fmt(a.title)}</h3><p>${str(a.description) ? fmt(a.description) : ph('One-line use case')}</p></div>`).join('') + '</div></div></section>';

  const props = list(c.properties).filter((p) => str(p.label));
  const rows = props.length ? props.map((p) => [p.label, str(p.value) || '[Value]', str(p.method) || '[ASTM / ISO]', p])
    : [['Carrier resin', comp ? '[Compostable carrier]' : 'PP / HDPE'], ['Bio-calcium content', '[%]'], ['Recommended let-down', '[% range]'], ['Melt flow index', '[g/10 min]'], ['Density', '[g/cm³]'], ['Moisture', '[%]'], ['Processes', comp ? '[Processes]' : 'Injection, extrusion, blow moulding, thermoforming'], ['Pack size', '[25 kg bags / 1 t bulk]']].map((r) => [...r, '[ASTM / ISO]']);
  const cell = (v) => (str(v).startsWith('[') ? `<span class="ph">${esc(v)}</span>` : esc(v));
  h += '<section class="sec" id="tech"><div class="wrap split"><div><span class="eyebrow">Technical information</span><h2 style="font-size:clamp(28px,3cqi,38px);color:var(--deep);margin-top:10px">Typical properties</h2><p style="color:var(--muted);margin-top:14px">Values from the technical data sheet. Request the full TDS for test methods.</p></div><div class="table-wrap"><table><thead><tr><th>Property</th><th>Value</th><th>Method</th></tr></thead><tbody>' +
    rows.map(([l, v, m, b]) => `${editable(b)}<tr><th>${esc(l)}</th><td>${cell(v)}</td><td>${cell(m)}</td></tr>`).join('') + '</tbody></table></div></div></section>';

  const certs = list(c.certifications).filter((b) => str(b.title));
  const badges = certs.length ? certs.map((b) => [b.mark, b.title, b.caption]) : plat.certs.concat(COMMON_CERTS);
  h += '<section class="sec sec--mist" id="certs"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Certifications</span><h2>Certifications and compliance</h2></div><p>Show only credentials that apply to this exact grade, with the scope and authorised artwork.</p></div><div class="grid g4">' +
    badges.map(([m, t, cap]) => `<div class="badge"><i>${esc(m)}</i><b>${esc(t)}</b><small>${esc(cap)}</small></div>`).join('') + '</div></div></section>';

  const dl = (file, title, caption) => `<a class="dl" href="${esc(file?.filename || '#inquiry')}"><i>PDF</i><div><b>${title}</b><small>${caption}</small></div></a>`;
  h += `<section class="sec" id="inquiry"><div class="wrap gate"><div><form class="form" data-enquiry data-context="Inquire about ${esc(name)}"><h3>Inquire about ${esc(name)}</h3>` +
    '<div class="row"><label>Name<input name="name" autocomplete="name" placeholder="Full name"></label><label>Company<input name="company" autocomplete="organization" placeholder="Company" required></label></div>' +
    '<div class="row"><label>Work email<input type="email" name="email" autocomplete="email" placeholder="name@company.com" required></label><label>Country<input name="country" autocomplete="country-name" placeholder="Country"></label></div>' +
    '<div class="row"><label>Polymer<select data-field="Polymer"><option>PP</option><option>HDPE</option><option>Other</option></select></label><label>Process<select data-field="Process"><option>Injection moulding</option><option>Extrusion</option><option>Blow moulding</option><option>Thermoforming</option><option>Other</option></select></label></div>' +
    '<label>Message<textarea name="message" required placeholder="Tell us the polymer, process and application"></textarea></label><div><button class="btn btn--primary" type="submit">Send inquiry</button></div><p class="status" role="status" aria-live="polite" hidden></p></form></div>' +
    `<div class="side" id="downloads"><span class="eyebrow">Downloads</span>${dl(c.tds_file, 'Technical data sheet (TDS)', `${esc(name)} · ${esc(str(c.tds_version) || '[version]')}`)}${dl(c.sds_file, 'Safety data sheet (SDS)', `${esc(name)} · ${esc(str(c.sds_version) || '[version]')}`)}${dl(c.guide_file, 'Processing guide', 'Let-down, drying, settings')}` +
    '<p style="font-size:14px;color:var(--stone)">Downloads ask for a work email first.</p></div></div></section>';
  return h;
}
