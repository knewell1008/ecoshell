import {resolveSecret} from './supabase.js';
import {renderBlocks, BLOCK_TYPES, needsArticles} from './blocks.js';
import {renderProduct, productTitle} from './product.js';
import {renderArticle, articleTitle} from './article.js';
import {renderPage} from './frame.js';
import DEFAULTS from './site-defaults.json';

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

// Published Article stories in the news folder, newest first (for Latest news and article pages).
async function fetchArticles(token, draft) {
  const q = new URLSearchParams({token, version: draft ? 'draft' : 'published', starts_with: 'news/', content_type: 'article', sort_by: 'content.date:desc', per_page: '50'});
  if (draft) q.set('cv', String(Date.now()));
  const res = await fetch(API.replace(/\/$/, '') + '?' + q, draft ? {} : {cf: {cacheTtl: 60, cacheEverything: true}});
  if (!res.ok) return [];
  return ((await res.json()).stories || []).filter((s) => !isTemplate(s));
}

const isTemplate = (story) => /(^|\/)template-/.test(story?.full_slug || '');

// A story we can render: a Page with at least one of our blocks (not e.g. Storyblok's sample), or a Product.
function usable(story) {
  const c = story?.content;
  if (c?.component === 'page') return (c.body || []).some((b) => BLOCK_TYPES.includes(b.component));
  if (c?.component === 'article') return true;
  return c?.component === 'product' && story.full_slug.startsWith('products/');
}

// x-content-source says which copy was served, for checking from outside: storyblok, or static with the reason.
function tagged(res, source, status) {
  const out = new Response(res.body, {status: status || res.status, headers: res.headers});
  out.headers.set('x-content-source', source);
  return out;
}

function render(story, settings, path, draft, articles) {
  const c = story.content;
  const kind = c.component;
  const slug = story.full_slug;
  const body = kind === 'product' ? renderProduct(c, story.slug, {draft})
    : kind === 'article' ? renderArticle(story, {draft, articles})
    : renderBlocks(c.body, {draft, data: {articles}});
  const name = kind === 'product' ? productTitle(c) : kind === 'article' ? articleTitle(c, story) : str(c.title) || story.name;
  const title = slug === 'home' ? `Ecoshell | ${name}` : `${name} | Ecoshell`;
  const description = kind === 'page' ? str(c.description) || `${name}: Ecoshell eggshell-derived materials for plastic reduction.` : str(c.summary);
  let html = renderPage({settings: settings?.content, path, title, description, body,
    editable: draft && settings?.content?._editable ? settings.content._editable : ''});
  if (draft) {
    // Visual Editor preview: load the bridge and reload the preview each time the editor saves.
    // Links followed inside the preview keep the signed _storyblok parameters, so the next page is a
    // draft preview too (its sections can be clicked to open that story), and the address names the
    // story now shown.
    html = html.replace('</body>', `<script src="${BRIDGE}"></script><script>new window.StoryblokBridge().on(['change','published'],function(){location.reload()});
(function(){var q=new URLSearchParams(location.search),id=${JSON.stringify(String(story.id || ''))};
if(id&&q.get('_storyblok')!==id){q.set('_storyblok',id);history.replaceState(null,'',location.pathname+'?'+q+location.hash)}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var u=new URL(a.href,location.href);
if(u.origin!==location.origin||/^\\/(portal|admin|api|assets)/.test(u.pathname)||(u.pathname===location.pathname&&u.hash))return;
new URLSearchParams(location.search).forEach(function(v,k){if(k.indexOf('_storyblok')===0)u.searchParams.set(k,v)});a.href=u.href},true)})();</script>\n</body>`);
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
  // Templates ("template-..." stories, to duplicate) are only ever shown in the Visual Editor.
  if (!draft && isTemplate(story)) story = null;

  // Redirects from Site settings, for pages that moved. A page that exists at the address wins.
  if (!usable(story)) {
    const norm = (p) => '/' + str(p).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/+$/, '');
    const redirects = settings?.content?.redirects?.length ? settings.content.redirects : DEFAULTS.redirects || [];
    const hit = redirects.find((r) => str(r.from) && norm(r.from) === norm(url.pathname));
    if (hit && str(hit.to)) return Response.redirect(new URL(str(hit.to) + (str(hit.to).includes('?') ? '' : url.search), url).href, 301);
  }

  try {
    if (usable(story)) {
      const articles = story.content.component === 'article' || needsArticles(story.content.body) ? await fetchArticles(token, draft) : [];
      return HTML(render(story, settings, url.pathname, draft, articles), 200, draft, draft ? 'storyblok draft' : 'storyblok');
    }
    if (isStatic) return tagged(page, 'static; story not found');
    const missing = await fetchStory('not-found', token, draft);
    if (usable(missing)) return HTML(render(missing, settings, url.pathname, draft, []), 404, draft, 'storyblok not-found');
  } catch (error) {
    if (isStatic) return tagged(page, `static; ${error.message}`.slice(0, 200));
  }
  return page;
}
