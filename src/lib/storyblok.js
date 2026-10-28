import {resolveSecret} from './supabase.js';
import {renderBlocks, BLOCK_TYPES} from './blocks.js';

// Pages are edited in Storyblok. The static HTML stays the source of the menu, footer and styles,
// and the fallback: when a story is published, it replaces the matching parts of the page as it
// is served. Without STORYBLOK_TOKEN, or if Storyblok is unreachable, the static page is served unchanged.
// - Product stories (folder "products") fill fields of the nine product pages.
// - Page stories (any path, e.g. "sustainability", "company/team", "products/" for a folder's
//   start page) replace the whole <main> with their blocks, rendered by blocks.js.
const API = 'https://api.storyblok.com/v2/cdn/stories/';
const BRIDGE = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
const PRODUCTS = ['core', 'flow', 'expand', 'mold', 'complete', 'bioflex', 'bioform', 'bioshape', 'shield'];
const PATH = new RegExp(`^/products/(${PRODUCTS.join('|')})(?:\\.html)?$`);
// Not content pages: the portal and admin apps, the old addresses that redirect, and files.
const NOT_PAGES = /^\/(api|portal|admin|solutions|insights|about|assets)(\/|\.html$|$)/;

const str = (v) => String(v ?? '').trim();
const esc = (v) => str(v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
// Text in [square brackets] is still a placeholder, shown the way the static pages show them.
const cell = (v) => (str(v).startsWith('[') ? `<span class="ph">${esc(v)}</span>` : esc(v));
const shortName = (name) => name.replace(/^Ecoshell /, '');

export function productSlug(url) {
  return PATH.exec(url.pathname)?.[1] || null;
}

// The Storyblok slug for a page path: "/" is "home", "/products/" is the products folder's start page.
export function pageSlug(url) {
  const p = url.pathname;
  if (NOT_PAGES.test(p) || /\.(?!html$)[a-z0-9]+$/i.test(p)) return null;
  if (p === '/' || p === '/index.html') return 'home';
  if (p.endsWith('/')) return p.slice(1);
  return p.slice(1).replace(/\.html$/, '').replace(/(^|\/)index$/, '$1');
}

// The Visual Editor signs its preview links with sha1(space_id:preview_token:timestamp).
async function isPreview(url, token) {
  if (!url.searchParams.has('_storyblok')) return false;
  const q = (k) => url.searchParams.get(`_storyblok_tk[${k}]`);
  if (!q('space_id') || !q('timestamp') || !q('token')) return false;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${q('space_id')}:${token}:${q('timestamp')}`));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('') === q('token');
}

async function fetchStory(fullSlug, component, token, draft) {
  const q = new URLSearchParams({token, version: draft ? 'draft' : 'published'});
  if (draft) q.set('cv', String(Date.now()));
  const res = await fetch(API + fullSlug + '?' + q, draft ? {} : {cf: {cacheTtl: 60, cacheEverything: true}});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storyblok returned ${res.status}`);
  const content = (await res.json()).story?.content;
  return content?.component === component ? content : null;
}

function pageRewriter(c, draft, slug) {
  const title = str(c.title);
  const inner = (html) => ({element: (el) => el.setInnerContent(html, {html: true})});
  let rw = new HTMLRewriter().on('main#content', inner(renderBlocks(c.body, {draft})));
  if (title) rw = rw.on('title', inner(esc(slug === 'home' ? `Ecoshell | ${title}` : `${title} | Ecoshell`)));
  if (str(c.description)) rw = rw.on('meta[name="description"]', {element: (el) => el.setAttribute('content', str(c.description))});
  return rw;
}

function productRewriter(c, draft) {
  const name = str(c.name);
  const summary = str(c.summary);
  const description = str(c.description) || summary;
  const details = str(c.details).split(/\n\s*\n/).map(str).filter(Boolean);
  const apps = (c.applications || []).filter((a) => str(a.title));
  const props = (c.properties || []).filter((p) => str(p.label));
  const image = c.hero_image?.filename;
  const editable = (blok) => (draft && blok?._editable) || '';
  const inner = (html) => ({element: (el) => el.setInnerContent(html, {html: true})});

  let rw = new HTMLRewriter();
  if (name) {
    rw = rw
      .on('title', inner(`${esc(shortName(name))} | Ecoshell`))
      .on('.phero h1', inner(esc(name)))
      // Crumbs are Home / Products / Platform / Name, so the name is the fourth span (HTMLRewriter has no :last-child).
      .on('.phero .crumbs > span:nth-of-type(4)', inner(esc(shortName(name))))
      .on('#apps h2', inner(`Where ${esc(shortName(name))} is used`))
      .on('form[data-enquiry] h3', inner(`Inquire about ${esc(name)}`))
      .on('form[data-enquiry]', {element: (el) => el.setAttribute('data-context', `Inquire about ${name}`)});
  }
  if (summary) {
    rw = rw
      .on('meta[name="description"]', {element: (el) => el.setAttribute('content', summary)})
      .on('.phero p.sub', inner(esc(summary)));
  }
  if (description) rw = rw.on('#desc p.lead', inner(esc(description)));
  if (details.length) {
    rw = rw.on('#desc .prose > p:not(.lead)', {
      element: (el) => el.replace(details.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''), {html: true})
    });
  }
  if (image) {
    // Storyblok asset URLs carry the size (/f/<space>/<w>x<h>/...); only shrink, never upscale.
    const width = Number(/\/(\d+)x\d+\//.exec(image)?.[1] || 0);
    rw = rw.on('.phero img', {element: (el) => {
      el.setAttribute('src', `${image}/m/${width > 1600 ? '1600x0' : ''}`);
      el.setAttribute('alt', str(c.hero_image.alt));
    }});
  }
  if (apps.length) {
    rw = rw.on('#apps .grid', inner(apps.map((a) =>
      `${editable(a)}<div class="card"><h3 style="font-size:19px">${esc(a.title)}</h3><p>${str(a.description) ? esc(a.description) : '<span class="ph">[One-line use case]</span>'}</p></div>`
    ).join('')));
  }
  if (props.length) {
    rw = rw.on('#tech tbody', inner(props.map((p) =>
      `${editable(p)}<tr><th>${esc(p.label)}</th><td>${cell(p.value || '[Value]')}</td><td>${cell(p.method || '[ASTM / ISO]')}</td></tr>`
    ).join('')));
  }
  if (draft) rw = rw.on('.phero', {element: (el) => el.before(editable(c), {html: true})});
  return rw;
}

// Visual Editor preview: load the bridge and reload the preview each time the editor saves.
const withBridge = (rw) => rw.on('body', {element: (el) => el.append(
  `<script src="${BRIDGE}"></script><script>new window.StoryblokBridge().on(['change','published'],function(){location.reload()})</script>`,
  {html: true}
)});

// x-content-source says which copy was served, for checking from outside: storyblok, or static with the reason.
function tagged(page, source) {
  const res = new Response(page.body, page);
  res.headers.set('x-content-source', source);
  return res;
}

async function serve(request, env, fullSlug, component, makeRewriter) {
  const page = await env.ASSETS.fetch(request);
  if (page.status !== 200 || !(page.headers.get('content-type') || '').includes('text/html')) return page;
  const token = str(await resolveSecret(env.STORYBLOK_TOKEN));
  if (!token) return tagged(page, 'static; no token');

  const url = new URL(request.url);
  let content, draft = false;
  try {
    draft = await isPreview(url, token);
    content = await fetchStory(fullSlug, component, token, draft);
  } catch (error) {
    return tagged(page, `static; ${error.message}`.slice(0, 200));
  }
  if (!content) return tagged(page, 'static; story not found');
  // A Page story with none of our blocks (e.g. Storyblok's sample Home) would render an empty page.
  if (component === 'page' && !(content.body || []).some((b) => BLOCK_TYPES.includes(b.component))) {
    return tagged(page, 'static; story has no site blocks');
  }

  let rw;
  try {
    rw = makeRewriter(content, draft);
    if (draft) rw = withBridge(rw);
  } catch (error) {
    return tagged(page, `static; ${error.message}`.slice(0, 200));
  }
  const res = new Response(rw.transform(page).body, page);
  res.headers.delete('etag');
  res.headers.set('cache-control', draft ? 'no-store' : 'public, max-age=0, must-revalidate');
  res.headers.set('x-content-source', draft ? 'storyblok draft' : 'storyblok');
  return res;
}

export const productPage = (request, env, slug) => serve(request, env, `products/${slug}`, 'product', productRewriter);
export const contentPage = (request, env, slug) => serve(request, env, slug, 'page', (c, draft) => pageRewriter(c, draft, slug));
