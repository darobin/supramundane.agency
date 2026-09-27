// Static site generator: content/ + public/ → site/
import { mkdir, writeFile, rm, cp, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { loadAll, walk, OUT_DIR, PUBLIC_DIR, ROOT } from '../lib/content.js';
import { collections, slugify } from '../lib/schema.js';
import { today, partition, byDate } from '../lib/dates.js';
import * as T from './templates.js';

const HOME_LIMIT = 12;

// Builds into a private staging directory and swaps it in at the end, so that
// overlapping builds (the CMS watcher and a manual `npm run build`, say) never
// delete files out from under each other and a failed build leaves site/ intact.
export async function build({ out: dest = OUT_DIR, quiet = false } = {}) {
  const started = Date.now();
  const content = await loadAll();
  const ctx = { ...content, today: today() };

  const stamp = `${process.pid}-${started}-${Math.random().toString(36).slice(2, 8)}`;
  const out = `${dest}.tmp-${stamp}`;
  try {
    await mkdir(out, { recursive: true });
    await generate(ctx, out);
  } catch (err) {
    await rm(out, { recursive: true, force: true });
    throw err;
  }
  // Another build can slip its own swap in between our two renames; move that aside too.
  for (let i = 0; ; i++) {
    const old = `${dest}.old-${stamp}-${i}`;
    await rename(dest, old).catch((err) => { if (err.code !== 'ENOENT') throw err; });
    rm(old, { recursive: true, force: true }).catch(() => {});
    try {
      await rename(out, dest);
      break;
    } catch (err) {
      if (!['ENOTEMPTY', 'EEXIST'].includes(err.code) || i >= 5) throw err;
    }
  }

  const ms = Date.now() - started;
  if (!quiet) console.log(`built ${ctx.news.length} news, ${ctx.videos.length} videos, ${ctx.reports.length} reports, ${ctx.people.length} people, ${ctx.pages.length} pages → ${path.relative(ROOT, dest)}/ in ${ms}ms`);
  return { ms, today: ctx.today };
}

async function generate(ctx, out) {
  await cp(PUBLIC_DIR, out, { recursive: true });

  const write = async (url, html) => {
    const file = url.endsWith('/') ? path.join(out, url, 'index.html') : path.join(out, url);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
  };

  // Sibling assets (images, PDFs, videos) go next to their items' URLs.
  for (const [type, col] of Object.entries(collections)) {
    const dir = path.join(ROOT, col.dir);
    for (const f of await walk(dir).catch(() => [])) {
      if (f.endsWith('.md')) continue;
      const rel = path.relative(dir, f).split(path.sep).join('/');
      const dest = path.join(out, col.urlPrefix, rel);
      await mkdir(path.dirname(dest), { recursive: true });
      await cp(f, dest);
    }
  }

  // Home + news
  const { todays, upcoming, previously } = partition(ctx.news);
  await write('/', T.homePage(ctx, { todays, upcoming, previously, limit: HOME_LIMIT }));
  await write('/news/', T.newsIndex(ctx, ctx.news));
  // news is sorted newest first: "prev" is older, "next" is newer
  await Promise.all(ctx.news.map((item, i) =>
    write(item.url, T.newsItem(ctx, item, { prev: ctx.news[i + 1], next: ctx.news[i - 1] }))));

  // Videos
  await write('/videos/', T.videosIndex(ctx, ctx.videos));
  for (const v of ctx.videos) await write(v.url, T.videoItem(ctx, v));

  // Reports
  await write('/reports/', T.reportsIndex(ctx, ctx.reports));
  for (const r of ctx.reports) {
    const size = r.data.pdf ? await fileSize(path.join(r.dir, r.data.pdf)) : '';
    await write(r.url, T.reportItem(ctx, r, size));
  }

  // People
  await write('/people/', T.peopleIndex(ctx, ctx.people));
  for (const p of ctx.people) await write(p.url, T.personItem(ctx, p));

  // Free-form pages
  for (const p of ctx.pages) await write(p.url, T.page(ctx, p));

  // Tags across everything dated
  const dated = [...ctx.news, ...ctx.videos, ...ctx.reports].sort(byDate(-1));
  const tags = new Map();
  for (const i of dated) for (const t of i.data.tags || []) tags.set(t, (tags.get(t) || 0) + 1);
  const sortedTags = [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  await write('/tags/', T.tagsIndex(ctx, sortedTags));
  for (const [t] of sortedTags) await write(`/tags/${slugify(t)}/`, T.tagPage(ctx, t, dated.filter((i) => (i.data.tags || []).includes(t))));

  // Feed, 404, well-known
  await write('/feed.atom', T.atomFeed(ctx, dated.slice(0, 20)));
  await write('/404.html', T.notFound(ctx));
  if (ctx.site.atprotoDid) await write('/.well-known/atproto-did', ctx.site.atprotoDid + '\n');
  if (ctx.site.publicationUri) await write('/.well-known/site.standard.publication', ctx.site.publicationUri + '\n');
}

async function fileSize(file) {
  try {
    const { size } = await stat(file);
    return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
  } catch { return ''; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'build/index.js')) {
  build().catch((err) => { console.error(err); process.exit(1); });
}
