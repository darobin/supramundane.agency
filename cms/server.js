// The local CMS: a JSON API over the content tree, the admin UI, a preview
// server for the built site, and the publish pipeline.
import express from 'express';
import { readFile, writeFile, mkdir, rename, rm, copyFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ROOT, OUT_DIR, loadSite, saveSite, loadCollection, loadItem, saveItem, deleteItem, fileFor, exists } from '../lib/content.js';
import { collections, siteFields, validate, forEachAsset } from '../lib/schema.js';
import { today } from '../lib/dates.js';
import { build } from '../build/index.js';
import { publish, deployConfig } from './deploy.js';
import * as at from './atproto.js';

const CMS_PORT = Number(process.env.CMS_PORT || 4321);
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT || 4322);
const STATE_DIR = path.join(ROOT, '.cms');
const UPLOADS = path.join(STATE_DIR, 'uploads');
const SETTINGS = path.join(STATE_DIR, 'settings.json');

await mkdir(UPLOADS, { recursive: true });
let settings = { autoPublish: false, autoAnnounce: false, ...((await exists(SETTINGS)) ? JSON.parse(await readFile(SETTINGS, 'utf8')) : {}) };

// ── Events (SSE) ─────────────────────────────────────────────────────────────
const clients = new Set();
function emit(type, payload = {}) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(msg);
}

// ── Build & publish pipeline ─────────────────────────────────────────────────
let building = null;
let lastBuild = null;
let lastPublish = null;
async function rebuild(reason = 'manual') {
  if (building) return building;
  building = (async () => {
    try {
      const r = await build({ quiet: true });
      lastBuild = { at: new Date().toISOString(), ms: r.ms, reason };
      emit('built', lastBuild);
      return lastBuild;
    } catch (err) {
      console.error('build failed:', err);
      emit('error', { where: 'build', message: err.message });
      throw err;
    } finally {
      building = null;
    }
  })();
  return building;
}

let publishing = null;
async function doPublish(reason = 'manual') {
  if (publishing) return publishing;
  publishing = (async () => {
    try {
      await rebuild(reason);
      const r = await publish({ log: (line) => emit('publish-log', { line }) });
      lastPublish = { at: new Date().toISOString(), ...r, reason };
      emit('published', lastPublish);
      return lastPublish;
    } catch (err) {
      console.error('publish failed:', err.message);
      emit('error', { where: 'publish', message: err.message });
      throw err;
    } finally {
      publishing = null;
    }
  })();
  return publishing;
}

// Content saved through the API triggers a rebuild (and a publish when auto-publish is on).
async function afterChange(reason) {
  await rebuild(reason);
  if (settings.autoPublish) doPublish(reason).catch(() => {});
}

// Files edited outside the CMS (an editor, git) rebuild the preview too.
let watchTimer = null;
for (const dir of ['content', 'public', 'build', 'lib']) {
  try {
    watch(path.join(ROOT, dir), { recursive: true }, (evt, file) => {
      if (!file || /(^|\/)\./.test(file)) return;
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => rebuild(`fs:${file}`).catch(() => {}), 300);
    });
  } catch (err) {
    console.warn(`not watching ${dir}: ${err.message}`);
  }
}

// ── API ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const summary = (i) => ({ id: i.id, url: i.url, urlDir: i.urlDir, title: i.title, data: i.data });

app.get('/api/state', wrap(async (req, res) => {
  const schema = Object.fromEntries(Object.entries(collections).map(([k, c]) => [k, {
    label: c.label, singular: c.singular, dir: c.dir, urlPrefix: c.urlPrefix, dated: !!c.dated, fields: c.fields,
  }]));
  const items = {};
  for (const type of Object.keys(collections)) items[type] = (await loadCollection(type)).map(summary);
  res.json({
    schema, siteFields, site: await loadSite(), items, today: today(),
    atproto: at.status(), deploy: await deployConfig(), settings, lastBuild, lastPublish,
    previewUrl: `http://localhost:${PREVIEW_PORT}`,
  });
}));

app.get('/api/items/:type/:id', wrap(async (req, res) => {
  const item = await loadItem(type(req), req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json({ ...summary(item), body: item.body });
}));

// Create or update. `from` is the previous id when the item is being renamed
// (news ids embed the date and slug). Field values of the form "upload:<name>"
// are moved from the upload area into the item's directory.
app.put('/api/items/:type/:id', wrap(async (req, res) => {
  const t = type(req);
  const id = req.params.id;
  const { data = {}, body = '', from } = req.body;
  const problems = validate(t, data);
  if (problems.length) return res.status(400).json({ error: problems.join('; '), problems });

  const file = fileFor(t, id);
  if (from && from !== id) {
    const old = await loadItem(t, from);
    if (!old) return res.status(404).json({ error: `no such item to rename: ${from}` });
    await mkdir(path.dirname(file), { recursive: true });
    if (await exists(file)) return res.status(409).json({ error: `an item already exists at ${id}` });
    await rename(old.file, file);
    // Carry the assets along when the directory changes.
    if (path.dirname(old.file) !== path.dirname(file)) {
      const moves = [];
      forEachAsset(t, data, (v) => { if (!v.startsWith('upload:')) moves.push(v); });
      for (const v of moves) {
        if (await exists(path.join(old.dir, v))) await rename(path.join(old.dir, v), path.join(path.dirname(file), v));
      }
    }
  } else if (!from && (await exists(file))) {
    return res.status(409).json({ error: `an item already exists at ${id}` });
  }

  // Move fresh uploads into the item's directory as <slug>[-<n>].<ext>.
  const slug = id.split('/').pop();
  const pending = [];
  forEachAsset(t, data, (v, set, f, i) => { if (typeof v === 'string' && v.startsWith('upload:')) pending.push({ v, set, i }); });
  for (const { v, set, i } of pending) {
    const src = path.join(UPLOADS, path.basename(v.slice(7)));
    if (!(await exists(src))) return res.status(400).json({ error: `upload ${v} has expired` });
    const name = `${slug}${i === null ? '' : `-${i + 1}`}${path.extname(src)}`;
    await mkdir(path.dirname(file), { recursive: true });
    await rm(path.join(path.dirname(file), name), { force: true });
    await rename(src, path.join(path.dirname(file), name));
    set(name);
  }

  const item = await saveItem(t, id, data, body);
  emit('items-changed', { type: t, id });
  res.json({ ...summary(item), body: item.body });
  const isNew = !from;
  if (isNew && settings.autoAnnounce && t === 'news' && announceable(t) && at.status().loggedIn) {
    // New news goes out on its own; the announce pipeline publishes the site itself.
    announceItem(t, id, { post: true })
      .then((r) => emit('announced', { type: t, id, ...r }))
      .catch((err) => emit('error', { where: 'announce', message: err.message }));
  } else {
    afterChange(`save ${t}/${id}`).catch(() => {});
  }
}));

app.delete('/api/items/:type/:id', wrap(async (req, res) => {
  const ok = await deleteItem(type(req), req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  emit('items-changed', { type: type(req), id: req.params.id, deleted: true });
  res.json({ ok: true });
  afterChange(`delete ${req.params.id}`).catch(() => {});
}));

// Raw-body upload; returns a token to put in a field, resolved on save.
const rawTypes = ['image/*', 'video/*', 'application/pdf', 'application/octet-stream'];
app.post('/api/uploads', express.raw({ type: rawTypes, limit: '1gb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'empty upload' });
  const ext = extFor(req.get('content-type'), req.get('x-filename'));
  const name = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOADS, name), req.body);
  res.json({ token: `upload:${name}`, size: req.body.length });
}));
app.get('/api/uploads/:name', (req, res) => res.sendFile(path.join(UPLOADS, path.basename(req.params.name))));

app.put('/api/site', wrap(async (req, res) => {
  const site = { ...(await loadSite()), ...req.body };
  await saveSite(site);
  res.json(site);
  afterChange('site settings').catch(() => {});
}));

app.put('/api/settings', wrap(async (req, res) => {
  settings = { ...settings, ...req.body };
  await writeFile(SETTINGS, JSON.stringify(settings, null, 2));
  res.json(settings);
}));

app.post('/api/build', wrap(async (req, res) => res.json(await rebuild('manual'))));
app.post('/api/publish', wrap(async (req, res) => res.json(await doPublish('manual'))));

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ── ATProto ──────────────────────────────────────────────────────────────────
app.post('/api/atproto/login', wrap(async (req, res) => {
  const status = await at.login(req.body);
  res.json(status);
  afterChange('atproto login').catch(() => {});
}));
app.post('/api/atproto/logout', wrap(async (req, res) => res.json(await at.logout())));
app.post('/api/atproto/publication', wrap(async (req, res) => {
  const r = await at.ensurePublication({ iconFile: path.join(ROOT, 'public/img/publication-icon.png') });
  res.json(r);
  afterChange('publication record').catch(() => {});
}));

// What the Bluesky post would say.
app.get('/api/atproto/preview/:type/:id', wrap(async (req, res) => {
  const item = await loadItem(type(req), req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  const site = await loadSite();
  const pageUrl = `${site.url.replace(/\/$/, '')}${item.url}`;
  res.json({ text: at.defaultPostText(item, pageUrl), pageUrl });
}));

// Publish an item to ATProto: make sure the page is live first (the post links
// to it), create the records, remember their URIs, then rebuild and push again
// so the page carries its <link rel="site.standard.document">.
const announceable = (t) => collections[t].fields.some((f) => f.name === 'atUri');

async function recordItem(t, id, { post, text }) {
  const item = await loadItem(t, id);
  if (!item) throw Object.assign(new Error('not found'), { status: 404 });
  const r = await at.publishDocument(item, { post, text });
  const data = { ...item.data, atUri: r.atUri };
  if (r.bskyUri) { data.bskyUri = r.bskyUri; data.bskyCid = r.bskyCid; }
  await saveItem(t, item.id, data, item.body);
  emit('items-changed', { type: t, id: item.id });
  return { ...r, bskyWebUrl: r.bskyUri ? at.bskyWebUrl(r.bskyUri, at.status().handle) : null };
}

async function announceItem(t, id, opts) {
  if (!announceable(t)) throw Object.assign(new Error(`${t} cannot be published to ATProto`), { status: 400 });
  await doPublish(`pre-announce ${t}/${id}`);
  const r = await recordItem(t, id, opts);
  await doPublish(`announce ${t}/${id}`);
  return r;
}

app.post('/api/atproto/publish/:type/:id', wrap(async (req, res) => {
  const { post = true, text } = req.body || {};
  res.json(await announceItem(type(req), req.params.id, { post, text }));
}));

// Backfill: create standard.site records for every item that has none.
// Posting each to Bluesky is opt-in (it floods the timeline). Progress goes
// out over SSE; the site is pushed once at the start and once at the end.
app.post('/api/atproto/backfill', wrap(async (req, res) => {
  const { types = ['news', 'reports'], post = false } = req.body || {};
  const todo = [];
  for (const t of types) {
    if (!collections[t] || !announceable(t)) continue;
    for (const item of await loadCollection(t)) if (!item.data.atUri) todo.push({ type: t, id: item.id, title: item.title });
  }
  // Oldest first, so posts (if any) land in chronological order.
  todo.reverse();
  res.json({ queued: todo.length });
  if (!todo.length) return;
  try {
    await doPublish('pre-backfill');
    const done = [];
    const failed = [];
    for (const [i, { type: t, id, title }] of todo.entries()) {
      emit('backfill', { step: i + 1, total: todo.length, title, status: 'working' });
      try {
        done.push(await recordItem(t, id, { post }));
        emit('backfill', { step: i + 1, total: todo.length, title, status: 'done' });
      } catch (err) {
        failed.push({ id, error: err.message });
        emit('backfill', { step: i + 1, total: todo.length, title, status: 'failed', error: err.message });
      }
    }
    await doPublish('backfill');
    emit('backfill', { finished: true, done: done.length, failed });
  } catch (err) {
    emit('error', { where: 'backfill', message: err.message });
  }
}));

// ── Admin UI ─────────────────────────────────────────────────────────────────
app.use('/dist', express.static(path.join(ROOT, 'cms/ui/dist')));
app.use(express.static(path.join(ROOT, 'cms/ui'), { index: 'index.html' }));

// ── Preview server for the built site ────────────────────────────────────────
const preview = express();
preview.use(express.static(OUT_DIR, { extensions: ['html'], setHeaders: (res, p) => { if (p.includes('/.well-known/')) res.type('text/plain'); } }));
preview.use(async (req, res) => res.status(404).type('html').send(await readFile(path.join(OUT_DIR, '404.html'), 'utf8').catch(() => 'not found')));

// ── Go ───────────────────────────────────────────────────────────────────────
function type(req) {
  if (!collections[req.params.type]) { const e = new Error(`unknown collection ${req.params.type}`); e.status = 404; throw e; }
  return req.params.type;
}
function extFor(ct = '', filename = '') {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName) return fromName;
  const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'application/pdf': '.pdf', 'video/mp4': '.mp4', 'video/webm': '.webm' };
  return map[ct.split(';')[0]] || '';
}

await at.resume();
await rebuild('startup').catch(() => {});
app.listen(CMS_PORT, () => console.log(`CMS      → http://localhost:${CMS_PORT}/`));
preview.listen(PREVIEW_PORT, () => console.log(`preview  → http://localhost:${PREVIEW_PORT}/`));
