// HTML templates for the static site. Plain functions returning strings.
import { readableDate, isoDateTime } from '../lib/dates.js';
import { render, inline, plain } from '../lib/markdown.js';
import { slugify } from '../lib/schema.js';

export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" id="whole-supramundane-shape">
  <title>A geometric form based on quasicrystals</title>
  <defs>
    <g transform="scale(15) translate(-2.2, -16.5)" id="supramundane-shape">
      <path d="M 3.56, 17.66 L 3.94, 18.85 L 2.93, 19.59 L 2.55, 18.40 L 3.56, 17.66 z"></path>
      <path d="M 4.57, 16.93 L 5.82, 16.93 L 4.81, 17.66 L 3.56, 17.66 L 4.57, 16.93 z"></path>
      <path d="M 3.56, 17.66 L 4.81, 17.66 L 5.19, 18.85 L 3.94, 18.85 L 3.56, 17.66 z"></path>
      <path d="M 5.82, 16.93 L 6.21, 18.12 L 5.19, 18.85 L 4.81, 17.66 L 5.82, 16.93 z"></path>
      <path d="M 3.56, 20.04 L 2.55, 20.78 L 2.93, 19.59 L 3.94, 18.85 L 3.56, 20.04 z"></path>
      <path d="M 4.57, 20.78 L 3.56, 20.04 L 3.94, 18.85 L 4.96, 19.59 L 4.57, 20.78 z"></path>
      <path d="M 4.57, 20.78 L 3.56, 21.51 L 2.55, 20.78 L 3.56, 20.04 L 4.57, 20.78 z"></path>
      <path d="M 4.96, 19.59 L 6.21, 19.59 L 5.19, 18.85 L 3.94, 18.85 L 4.96, 19.59 z"></path>
      <path d="M 7.22, 18.85 L 6.21, 19.59 L 5.19, 18.85 L 6.21, 18.12 L 7.22, 18.85 z"></path>
    </g>
  </defs>
  <use href="#supramundane-shape" x="0" y="0" fill="#fff" stroke="var(--highlight)" stroke-linejoin="bevel"></use>
</svg>`;

function nav(ctx) {
  const items = [
    ['/', 'home'], ['/news/', 'news'], ['/videos/', 'videos'], ['/reports/', 'reports'], ['/people/', 'people'],
    ...ctx.pages.filter((p) => p.data.nav).map((p) => [p.url, p.data.title.toLowerCase()]),
    ['https://berjon.com/', 'blog'],
    [`mailto:${ctx.site.authorEmail}`, 'email'],
  ];
  return `<nav><ul>${items.map(([href, label]) => `<li><a href="${attr(href)}">${esc(label)}</a></li>`).join('')}</ul></nav>`;
}

// page: { title, description, url, image, imageAlt, atUri, type ('article'|'website'), body, scripts }
export function layout(ctx, page) {
  const { site } = ctx;
  const title = page.title ? `${page.title} — ${site.title}` : site.title;
  const description = page.description || site.description;
  const abs = (u) => (u ? new URL(u, site.url).href : '');
  const image = abs(page.image || '/img/card.jpg');
  return `<!doctype html>
<html lang="${attr(site.language || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/css/supramundane.css">
<link rel="shortcut icon" href="/icon.svg">
<link rel="canonical" href="${attr(abs(page.url))}">
<meta name="description" content="${attr(description)}">
<meta property="og:type" content="${page.type || 'website'}">
<meta property="og:site_name" content="${attr(site.title)}">
<meta property="og:title" content="${attr(page.title || site.title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(abs(page.url))}">
<meta property="og:image" content="${attr(image)}">
${page.imageAlt ? `<meta property="og:image:alt" content="${attr(page.imageAlt)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" href="/feed.atom" type="application/atom+xml" title="${attr(site.title)}">
${page.atUri ? `<link rel="site.standard.document" href="${attr(page.atUri)}">` : ''}
</head>
<body>
<a class="skip-to-content-link" href="#main">Skip to content</a>
${nav(ctx)}
<header>
  <a href="/" class="home-link">supramundane <span class="agency">agency</span>.</a>
  ${LOGO}
</header>
<main id="main">
${page.body}
</main>
${nav(ctx)}
<footer>
  <p>${inline(site.footer || '')}</p>
</footer>
<script src="/js/colours.js"></script>
${(page.scripts || []).map((s) => `<script src="${attr(s)}"></script>`).join('\n')}
</body>
</html>
`;
}

// ── Pieces ────────────────────────────────────────────────────────────────────

export function imageUrl(item, field = 'image') {
  return item.data[field] ? `${item.urlDir}${item.data[field]}` : '';
}

function location(loc) {
  if (!loc) return '';
  const where = loc === 'online'
    ? 'online'
    : `<a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(loc)}" class="location" target="_blank" rel="noopener">${esc(loc)}</a>`;
  return `${where} <span class="sep">⬩</span> `;
}

function time(ymd, today) {
  return `<time datetime="${ymd}" data-date="${ymd}"${ymd === today ? ' class="today"' : ''}>${readableDate(ymd)}</time>`;
}

export function card(item, ctx) {
  const img = imageUrl(item);
  const kind = item.type === 'news' ? '' : ` <span class="kind">${item.type === 'videos' ? 'video' : 'report'}</span>`;
  return `<li data-date="${item.data.date}"${item.data.date === ctx.today ? ' class="today"' : ''}>
  ${img ? `<a href="${item.url}"><img src="${attr(img)}" alt="${attr(item.data.imageAlt)}" width="560" height="350" loading="lazy"></a>` : ''}
  <h3><a href="${item.url}">${esc(item.title)}</a>${kind}</h3>
  <p>${esc(item.data.description)}</p>
  <div class="meta">${location(item.data.location)}${time(item.data.date, ctx.today)}</div>
</li>`;
}

export function cards(items, ctx) {
  return `<ol class="postlist">${items.map((i) => card(i, ctx)).join('\n')}</ol>`;
}

function tagList(tags = []) {
  if (!tags.length) return '';
  return `<ul class="tags">${tags.map((t, i) => `<li><a href="/tags/${slugify(t)}/" class="post-tag">${esc(t)}</a>${i < tags.length - 1 ? ', ' : ''}</li>`).join('')}</ul>`;
}

function peopleLine(item, ctx, label = 'With') {
  const refs = (item.data.people || []).map((slug) => ctx.people.find((p) => p.id === slug)).filter(Boolean);
  if (!refs.length) return '';
  return `<p class="people">${label}: ${refs.map((p) => `<a href="${p.url}">${esc(p.data.name)}</a>`).join(', ')}</p>`;
}

// ── Video embeds ─────────────────────────────────────────────────────────────

export function embedFor(url) {
  if (!url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  let m;
  if (host === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    const id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?]+)/) || [])[1];
    if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?dnt=1` };
  if (host === 'player.vimeo.com' && (m = u.pathname.match(/^\/video\/(\d+)/))) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?dnt=1` };
  // PeerTube: https://instance/w/ID or /videos/watch/ID → /videos/embed/ID
  if ((m = u.pathname.match(/^\/(?:w|videos\/(?:watch|embed))\/([^/?]+)/))) return { kind: 'iframe', src: `${u.origin}/videos/embed/${m[1]}` };
  return { kind: 'link', href: url };
}

export function videoPlayer(item) {
  const embed = embedFor(item.data.url);
  const poster = imageUrl(item);
  if (item.data.file) {
    return `<video controls preload="metadata" ${poster ? `poster="${attr(poster)}"` : ''} src="${attr(item.urlDir + item.data.file)}" class="player"></video>`;
  }
  if (embed?.kind === 'iframe') {
    return `<div class="embed"><iframe src="${attr(embed.src)}" title="${attr(item.title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  if (embed?.kind === 'link') return `<p><a href="${attr(embed.href)}">Watch the video</a></p>`;
  return '';
}

// ── Pages ────────────────────────────────────────────────────────────────────

export function homePage(ctx, { todays, upcoming, previously, limit }) {
  const section = (id, title, items, cls = '') => `<section id="${id}" class="news-section ${cls}"${items.length ? '' : ' hidden'}>
  <h2>${title}</h2>
  ${cards(items, ctx)}
</section>`;
  const shown = previously.slice(0, limit);
  const body = `<section id="about">${render(ctx.home?.body || '')}</section>
<hr>
<div data-news-sections data-limit="${limit}">
${section('news-today', 'Today', todays, 'today')}
${section('news-upcoming', 'Upcoming', upcoming)}
${section('news-previously', 'Previously', shown)}
<p id="news-more"${previously.length > limit ? '' : ' hidden'}><a href="/news/">more…</a></p>
</div>`;
  return layout(ctx, { url: '/', body, scripts: ['/js/news-today.js'] });
}

export function newsIndex(ctx, items) {
  const body = `<h2>All News</h2>${cards(items, ctx)}`;
  return layout(ctx, { title: 'News', url: '/news/', body });
}

export function newsItem(ctx, item, { prev, next }) {
  const video = item.data.video && ctx.videos.find((v) => v.id === item.data.video);
  const report = item.data.report && ctx.reports.find((r) => r.id === item.data.report);
  const body = `<section class="page news-item">
  ${tagList(item.data.tags)}
  <h1>${esc(item.title)}</h1>
  <div class="meta">${location(item.data.location)}${time(item.data.date, ctx.today)}</div>
  ${item.data.image ? `<img src="${attr(imageUrl(item))}" alt="${attr(item.data.imageAlt)}" width="560" height="350" class="illustration">` : ''}
  ${render(item.body)}
  ${peopleLine(item, ctx)}
  ${report ? `<p class="download"><a href="${report.url}" class="button">Read the report</a></p>` : ''}
  ${video ? `<section class="related-video"><h2>Recording</h2>${videoPlayer(video)}<p><a href="${video.url}">${esc(video.title)}</a></p></section>` : ''}
  ${prevNext(prev, next)}
</section>`;
  return layout(ctx, {
    title: item.title, description: item.data.description, url: item.url, type: 'article',
    image: imageUrl(item), imageAlt: item.data.imageAlt, atUri: item.data.atUri, body, scripts: ['/js/news-today.js'],
  });
}

function prevNext(prev, next) {
  if (!prev && !next) return '';
  return `<hr><div class="links-nextprev">
  ${prev ? `<a href="${prev.url}" class="prev">← ${esc(prev.title)}</a>` : ''}
  ${prev && next ? '<span class="sep">⬩</span>' : ''}
  ${next ? `<a href="${next.url}" class="next">${esc(next.title)} →</a>` : ''}
</div>`;
}

export function videosIndex(ctx, items) {
  const body = `<h2>Videos</h2>
<p>Talks, panels, and interviews.</p>
${cards(items, ctx)}`;
  return layout(ctx, { title: 'Videos', url: '/videos/', body });
}

export function videoItem(ctx, item) {
  const announced = ctx.news.filter((n) => n.data.video === item.id);
  const body = `<section class="page video-item">
  ${tagList(item.data.tags)}
  <h1>${esc(item.title)}</h1>
  <div class="meta">${item.data.event ? `${esc(item.data.event)} <span class="sep">⬩</span> ` : ''}${time(item.data.date, ctx.today)}</div>
  ${videoPlayer(item)}
  <p class="lede">${esc(item.data.description)}</p>
  ${render(item.body)}
  ${peopleLine(item, ctx)}
  ${item.data.url ? `<p class="source"><a href="${attr(item.data.url)}" rel="noopener">Watch at the source</a></p>` : ''}
  ${announced.length ? `<p class="related">See also: ${announced.map((n) => `<a href="${n.url}">${esc(n.title)}</a>`).join(', ')}</p>` : ''}
</section>`;
  return layout(ctx, {
    title: item.title, description: item.data.description, url: item.url, type: 'video.other',
    image: imageUrl(item), imageAlt: item.data.imageAlt, body,
  });
}

export function reportsIndex(ctx, items) {
  const body = `<h2>Reports</h2>
<p>Longer-form work: white papers, studies, and position papers.</p>
${cards(items, ctx)}`;
  return layout(ctx, { title: 'Reports', url: '/reports/', body });
}

export function reportItem(ctx, item, size) {
  const pdf = item.data.pdf ? `${item.urlDir}${item.data.pdf}` : '';
  const body = `<section class="page report-item">
  ${tagList(item.data.tags)}
  <h1>${esc(item.title)}</h1>
  <div class="meta">${item.data.publisher ? `${esc(item.data.publisher)} <span class="sep">⬩</span> ` : ''}${time(item.data.date, ctx.today)}</div>
  ${item.data.image ? `<img src="${attr(imageUrl(item))}" alt="${attr(item.data.imageAlt)}" width="560" height="350" class="illustration">` : ''}
  <p class="lede">${esc(item.data.description)}</p>
  ${pdf ? `<p class="download"><a href="${attr(pdf)}" class="button" download>Download the PDF${size ? ` <span class="size">(${size})</span>` : ''}</a></p>` : ''}
  ${render(item.body)}
  ${peopleLine(item, ctx, 'Authors')}
</section>`;
  return layout(ctx, {
    title: item.title, description: item.data.description, url: item.url, type: 'article',
    image: imageUrl(item), imageAlt: item.data.imageAlt, atUri: item.data.atUri, body,
  });
}

export function peopleIndex(ctx, items) {
  const body = `<h2>People</h2>
<ul class="people-grid">
${items.map((p) => `<li>
  <a href="${p.url}">${p.data.photo ? `<img src="${attr(imageUrl(p, 'photo'))}" alt="${attr(p.data.name)}" width="400" height="400" loading="lazy">` : ''}</a>
  <h3><a href="${p.url}">${esc(p.data.name)}</a></h3>
  ${p.data.role ? `<p>${esc(p.data.role)}</p>` : ''}
</li>`).join('\n')}
</ul>`;
  return layout(ctx, { title: 'People', url: '/people/', body });
}

export function personItem(ctx, p) {
  const links = [
    p.data.website && `<a href="${attr(p.data.website)}">${esc(p.data.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`,
    p.data.bluesky && `<a href="https://bsky.app/profile/${attr(p.data.bluesky)}">@${esc(p.data.bluesky)}</a>`,
    p.data.email && `<a href="mailto:${attr(p.data.email)}">${esc(p.data.email)}</a>`,
  ].filter(Boolean);
  const related = (type, label) => {
    const items = ctx[type].filter((i) => (i.data.people || []).includes(p.id));
    return items.length ? `<section><h2>${label}</h2>${cards(items, ctx)}</section>` : '';
  };
  const body = `<section class="page person">
  <h1>${esc(p.data.name)}</h1>
  ${p.data.role ? `<div class="meta">${esc(p.data.role)}</div>` : ''}
  ${p.data.photo ? `<img src="${attr(imageUrl(p, 'photo'))}" alt="${attr(p.data.name)}" width="400" height="400" class="illustration portrait">` : ''}
  ${render(p.body)}
  ${links.length ? `<p class="links">${links.join(' <span class="sep">⬩</span> ')}</p>` : ''}
</section>
${related('news', 'News')}
${related('videos', 'Videos')}
${related('reports', 'Reports')}`;
  return layout(ctx, {
    title: p.data.name, description: plain(p.body).split('\n')[0] || p.data.role, url: p.url, type: 'profile',
    image: imageUrl(p, 'photo'), imageAlt: p.data.name, body,
  });
}

export function page(ctx, p) {
  const body = `<section class="page"><h1>${esc(p.data.title)}</h1>${render(p.body)}</section>`;
  return layout(ctx, { title: p.data.title, description: p.data.description, url: p.url, body });
}

export function tagsIndex(ctx, tags) {
  const body = `<h2>Tags</h2>
<ul class="tag-index">${tags.map(([t, n]) => `<li><a href="/tags/${slugify(t)}/" class="post-tag">${esc(t)}</a> <span class="count">(${n})</span></li>`).join('')}</ul>`;
  return layout(ctx, { title: 'Tags', url: '/tags/', body });
}

export function tagPage(ctx, tag, items) {
  const body = `<h2>Tagged “${esc(tag)}”</h2>${cards(items, ctx)}<p>See <a href="/tags/">all tags</a>.</p>`;
  return layout(ctx, { title: `Tagged “${tag}”`, url: `/tags/${slugify(tag)}/`, body });
}

export function notFound(ctx) {
  return layout(ctx, { title: 'Not found', url: '/404.html', body: '<section class="page"><h1>Not found</h1><p>There is nothing here. Try the <a href="/">front page</a>.</p></section>' });
}

// ── Feed ─────────────────────────────────────────────────────────────────────

export function atomFeed(ctx, items) {
  const { site } = ctx;
  const abs = (u) => new URL(u, site.url).href;
  const updated = items[0] ? isoDateTime(items[0].data.date) : new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet href="/pretty-atom-feed.xsl" type="text/xsl"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.title)}</title>
  <subtitle>${esc(site.description)}</subtitle>
  <link href="${attr(abs('/feed.atom'))}" rel="self"/>
  <link href="${attr(site.url)}"/>
  <updated>${updated}</updated>
  <id>${attr(site.url)}</id>
  <author><name>${esc(site.authorName)}</name>${site.authorEmail ? `<email>${esc(site.authorEmail)}</email>` : ''}</author>
${items.map((i) => `  <entry>
    <title>${esc(i.title)}</title>
    <link href="${attr(abs(i.url))}"/>
    <updated>${isoDateTime(i.data.date)}</updated>
    <id>${attr(abs(i.url))}</id>
    <summary>${esc(i.data.description)}</summary>
    <content type="html">${esc(render(i.body))}</content>
  </entry>`).join('\n')}
</feed>
`;
}
