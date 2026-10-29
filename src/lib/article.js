// The <main> of a news article from a Storyblok Article story (folder "news"): a page header with the
// date and category, the article text, and the latest other articles.
import {str, esc, fmt, assetUrl, richtext, formatDate, renderBlocks} from './blocks.js';

export function articleTitle(c, story) {
  return str(c.title) || story.name;
}

export function renderArticle(story, {draft = false, articles = []} = {}) {
  const c = story.content || {};
  const title = articleTitle(c, story);
  const date = formatDate(c.date);
  const img = c.image?.filename ? c.image : {_file: 'assets/img/site/process.jpg'};
  const meta = [str(c.category), date].filter(Boolean).map(esc).join(' · ');

  let h = `${draft && c._editable ? c._editable : ''}<section class="phero"><div class="wrap"><div class="crumbs"><a href="/">Home</a><span>/</span><a href="/news/">News</a><span>/</span><span>${esc(title)}</span></div>` +
    `<div><span class="eyebrow">${meta || 'News'}</span><h1>${esc(title)}</h1>${str(c.summary) ? `<p class="sub">${fmt(c.summary)}</p>` : ''}</div>` +
    `<img src="${esc(assetUrl(img))}" alt="${esc(img.alt)}"></div></section>`;
  h += `<section class="sec"><div class="wrap"><div class="prose article">${richtext(c.body) || '<p><span class="ph">[Article text]</span></p>'}</div></div></section>`;
  h += renderBlocks([{component: 'news_list', eyebrow: 'News', heading: 'More from Ecoshell', link_label: 'All news', link: '/news/', count: 3, background: 'mist'}],
    {data: {articles, exclude: story.full_slug}});
  return h;
}
