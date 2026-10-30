// The <main> of a job opening from a Storyblok Job story (folder company/careers): a page header with
// department, location and type, the description, and how to apply.
import {str, esc, fmt, assetUrl, linkUrl, richtext, formatDate, jobMeta} from './blocks.js';

const CAREERS = '/company/careers';
const DEFAULT_EMAIL = 'careers@ecoshell.eco';

export function jobTitle(c, story) {
  return str(c.title) || story.name;
}

// Apply: the job-board link if there is one, else an email with the role in the subject.
export function applyUrl(c, title) {
  const link = linkUrl(c.apply_link);
  if (link) return link;
  const to = str(c.apply_email).replace(/^\[|\]$/g, '') || DEFAULT_EMAIL;
  return `mailto:${to}?subject=${encodeURIComponent(`Application: ${title}`)}`;
}

export function renderJob(story, {draft = false} = {}) {
  const c = story.content || {};
  const title = jobTitle(c, story);
  const apply = esc(applyUrl(c, title));
  const img = c.image?.filename ? c.image : {_file: 'assets/img/site/hero.jpg'};
  const facts = [['Department', c.department], ['Location', c.location], ['Type', c.employment_type], ['Apply by', formatDate(c.closing_date)]]
    .filter(([, v]) => str(v));

  const header = `<section class="phero"><div class="wrap"><div class="crumbs"><a href="/">Home</a><span>/</span><a href="/company/">Company</a><span>/</span><a href="${CAREERS}">Job opportunities</a><span>/</span><span>${esc(title)}</span></div>` +
    `<div><span class="eyebrow">${jobMeta(c).map(esc).join(' · ') || 'Careers'}</span><h1>${esc(title)}</h1>${str(c.summary) ? `<p class="sub">${fmt(c.summary)}</p>` : ''}` +
    `<div class="btns"><a class="btn btn--primary" href="${apply}">Apply for this role</a><a class="btn btn--outline" href="${CAREERS}">All open roles</a></div></div>` +
    `<img src="${esc(assetUrl(img))}" alt="${esc(img.alt)}"></div></section>`;

  const side = `<div class="side"><span class="eyebrow">How to apply</span>` +
    (facts.length ? `<dl class="list">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '') +
    `<p style="color:var(--muted)">${fmt(c.apply_text || 'Send your CV and a short note on why the role fits you. We reply to every application.')}</p>` +
    `<div class="btns" style="margin:0"><a class="btn btn--primary" href="${apply}">Apply for this role</a></div></div>`;

  const body = `<section class="sec"><div class="wrap gate"><div class="prose article">${richtext(c.body) || '<p><span class="ph">[Role description]</span></p>'}</div>${side}</div></section>`;

  return (draft && c._editable ? c._editable : '') + header + body;
}
