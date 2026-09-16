// Reading and writing the content tree. Used by the build and the CMS server.
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { collections, HOME_PAGE, titleOf } from './schema.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_FILE = path.join(ROOT, 'content/site.json');
export const OUT_DIR = path.join(ROOT, 'site');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export async function loadSite() {
  return JSON.parse(await readFile(SITE_FILE, 'utf8'));
}

export async function saveSite(site) {
  await writeFile(SITE_FILE, JSON.stringify(site, null, 2) + '\n');
}

// An item: { type, id, slug, url, file, dir, urlDir, data, body }
//  - id is the path relative to the collection dir, without extension
//    (news: "2025/0527-republica", everything else: the slug)
//  - url is where the item's page lives; urlDir is where its sibling assets go
export function itemFromFile(type, file, raw) {
  const col = collections[type];
  const rel = path.relative(path.join(ROOT, col.dir), file).replace(/\.md$/, '');
  const id = rel.split(path.sep).join('/');
  const { data, content } = matter(raw);
  // gray-matter parses YYYY-MM-DD as a Date; we want the string.
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Date) data[k] = v.toISOString().slice(0, 10);
  }
  const urlDir = col.urlPrefix + id.split('/').slice(0, -1).map((s) => `${s}/`).join('');
  const url = `${col.urlPrefix}${id}/`;
  return {
    type, id, slug: id.split('/').pop(), url, urlDir, file,
    dir: path.dirname(file), data, body: content.replace(/^\n+/, ''),
    title: titleOf(type, data),
  };
}

export async function loadCollection(type) {
  const col = collections[type];
  const dir = path.join(ROOT, col.dir);
  if (!existsSync(dir)) return [];
  const files = (await walk(dir)).filter((f) => f.endsWith('.md'));
  const items = await Promise.all(files.map(async (f) => itemFromFile(type, f, await readFile(f, 'utf8'))));
  if (col.dated) items.sort((a, b) => (a.data.date < b.data.date ? 1 : a.data.date > b.data.date ? -1 : 0));
  else if (type === 'people') items.sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100) || a.data.name.localeCompare(b.data.name));
  else items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}

export async function loadAll() {
  const site = await loadSite();
  const content = {};
  for (const type of Object.keys(collections)) content[type] = await loadCollection(type);
  content.home = content.pages.find((p) => p.id === HOME_PAGE) || null;
  content.pages = content.pages.filter((p) => p.id !== HOME_PAGE);
  return { site, ...content };
}

export async function loadItem(type, id) {
  const file = fileFor(type, id);
  if (!existsSync(file)) return null;
  return itemFromFile(type, file, await readFile(file, 'utf8'));
}

export function fileFor(type, id) {
  const col = collections[type];
  const safe = id.split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
  return path.join(ROOT, col.dir, `${safe}.md`);
}

// Write an item. `data` is the front matter (body excluded), `body` the markdown.
export async function saveItem(type, id, data, body = '') {
  const file = fileFor(type, id);
  await mkdir(path.dirname(file), { recursive: true });
  const fm = {};
  // Stable key order: schema order first, then anything else.
  for (const f of collections[type].fields) {
    if (f.kind === 'markdown') continue;
    const v = data[f.name];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    fm[f.name] = v;
  }
  for (const [k, v] of Object.entries(data)) if (!(k in fm) && k !== 'body' && v !== undefined && v !== '') fm[k] = v;
  await writeFile(file, matter.stringify(`\n${body.trim()}\n`, fm));
  return itemFromFile(type, file, await readFile(file, 'utf8'));
}

export async function deleteItem(type, id) {
  const item = await loadItem(type, id);
  if (!item) return false;
  await rm(item.file);
  // Remove the assets the item referenced, if nothing else in the dir uses them.
  const siblings = (await loadCollection(type)).filter((i) => i.dir === item.dir);
  for (const f of collections[type].fields) {
    if (!['image', 'file'].includes(f.kind) || !item.data[f.name]) continue;
    const used = siblings.some((s) => Object.values(s.data).includes(item.data[f.name]));
    if (!used) await rm(path.join(item.dir, item.data[f.name]), { force: true });
  }
  return true;
}

export async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

export async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
