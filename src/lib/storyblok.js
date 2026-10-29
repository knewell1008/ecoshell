import {resolveSecret} from './supabase.js';
import {renderBlocks, BLOCK_TYPES} from './blocks.js';
import {renderProduct, productTitle} from './product.js';
import {renderPage} from './frame.js';

// Content pages come from Storyblok. For a path, the Worker looks up the story with that slug
// ("/" is "home", "/products/" is the products folder's start page) and the Site settings story
// ("settings"), and renders the whole page: frame.js for the menu, footer and design, blocks.js for a
// Page story's sections, product.js for a Product story. So editors can add pages at new addresses.
// The static HTML files stay the fallback: they are served when there is no story for the path, when
// STORYBLOK_TOKEN is missing or Storyblok is unreachable. Unknown paths get the "not-found" Page story.
const API = 'https://api.storyblok.com/v2/cdn/stories/';
const BRIDGE = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
// Not content pages: the portal and admin apps, the old addresses that redirect, and files.
const NOT_PAGES = /^\/(api|portal|admin|solutions|insights|about|assets)(\/|\.html$|$)/;

const str = (v) => String(v ?? '').trim();

// The Storyblok slug for a page path, or null for paths that are never content pages.
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

async function fetchStory(fullSlug, token, draft) {
  const q = new URLSearchParams({token, version: draft ? 'draft' : 'published'});
  if (draft) q.set('cv', String(Date.now()));
  const res = await fetch(API + fullSlug + '?' + q, draft ? {} : {cf: {cacheTtl: 60, cacheEverything: true}});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storyblok returned ${res.status}`);
  return (await res.json()).story || null;
}

// A story we can render: a Page with at least one of our blocks (not e.g. Storyblok's sample), or a Product.
function usable(story) {
  const c = story?.content;
  if (c?.component === 'page') return (c.body || []).some((b) => BLOCK_TYPES.includes(b.component));
  return c?.component === 'product' && story.full_slug.startsWith('products/');
}

// x-content-source says which copy was served, for checking from outside: storyblok, or static with the reason.
function tagged(res, source, status) {
  const out = new Response(res.body, {status: status || res.status, headers: res.headers});
  out.headers.set('x-content-source', source);
  return out;
}

function render(story, settings, path, draft) {
  const c = story.content;
  const isProduct = c.component === 'product';
  const slug = story.full_slug;
  const body = isProduct ? renderProduct(c, story.slug, {draft}) : renderBlocks(c.body, {draft});
  const name = isProduct ? productTitle(c) : str(c.title) || story.name;
  const title = slug === 'home' ? `Ecoshell | ${name}` : `${name} | Ecoshell`;
  const description = isProduct ? str(c.summary) : str(c.description) || `${name}: Ecoshell eggshell-derived materials for plastic reduction.`;
  let html = renderPage({settings: settings?.content, path, title, description, body,
    editable: draft && settings?.content?._editable ? settings.content._editable : ''});
  if (draft) {
    // Visual Editor preview: load the bridge and reload the preview each time the editor saves.
    html = html.replace('</body>', `<script src="${BRIDGE}"></script><script>new window.StoryblokBridge().on(['change','published'],function(){location.reload()})</script>\n</body>`);
  }
  return html;
}

const HTML = (html, status, draft, source) => new Response(html, {status, headers: {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': draft ? 'no-store' : 'public, max-age=0, must-revalidate',
  'x-content-source': source
}});

export async function sitePage(request, env, slug) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(request);
  // Let the static site's redirects (e.g. /products -> /products/, /contact.html -> /contact) happen first.
  if (page.status >= 300 && page.status < 400) return page;
  const isStatic = page.status === 200 && (page.headers.get('content-type') || '').includes('text/html');

  const token = str(await resolveSecret(env.STORYBLOK_TOKEN));
  if (!token) return isStatic ? tagged(page, 'static; no token') : page;

  let draft = false, story, settings;
  try {
    draft = await isPreview(url, token);
    [story, settings] = await Promise.all([fetchStory(slug, token, draft), fetchStory('settings', token, draft).catch(() => null)]);
    if (!usable(story) && !isStatic && !slug.endsWith('/')) {
      // "/news" for a folder whose start page exists: send people to "/news/".
      const start = await fetchStory(slug + '/', token, draft);
      if (usable(start)) return Response.redirect(new URL(url.pathname + '/' + url.search, url).href, 308);
    }
  } catch (error) {
    return isStatic ? tagged(page, `static; ${error.message}`.slice(0, 200)) : page;
  }

  try {
    if (usable(story)) return HTML(render(story, settings, url.pathname, draft), 200, draft, draft ? 'storyblok draft' : 'storyblok');
    if (isStatic) return tagged(page, 'static; story not found');
    const missing = await fetchStory('not-found', token, draft);
    if (usable(missing)) return HTML(render(missing, settings, url.pathname, draft), 404, draft, 'storyblok not-found');
  } catch (error) {
    if (isStatic) return tagged(page, `static; ${error.message}`.slice(0, 200));
  }
  return page;
}
