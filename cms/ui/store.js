// Application state: one refrakt store, Elm-style. Components read from it
// with SignalWatcher and send actions; effects (API calls) live in the reducer
// as transactions.
import { store, tx } from 'refrakt/store.js';
import { computed } from 'refrakt/signal.js';
import { api } from './api.js';
import { collections, slugify, validate, titleOf } from '../../lib/schema.js';

export const initialState = {
  loading: true,
  error: null,
  toast: null,
  schema: {},
  siteFields: [],
  site: {},
  items: {},
  today: '',
  atproto: { loggedIn: false },
  deploy: {},
  settings: { autoPublish: false, autoAnnounce: false },
  backfill: null,
  lastBuild: null,
  lastPublish: null,
  previewUrl: '',
  busy: { build: false, publish: false, save: false, atproto: false },
  route: parseHash(location.hash),
  editor: null,
  announce: null,
  log: [],
};

export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { view: 'list', type: 'news' };
  if (parts[0] === 'site') return { view: 'site' };
  if (parts[0] === 'atproto') return { view: 'atproto' };
  const [type, action, ...rest] = parts;
  if (!collections[type]) return { view: 'list', type: 'news' };
  if (action === 'new') return { view: 'edit', type, id: null };
  if (action === 'edit') return { view: 'edit', type, id: rest.join('/') };
  return { view: 'list', type };
}

export function hashFor(route) {
  if (route.view === 'site') return '#/site';
  if (route.view === 'atproto') return '#/atproto';
  if (route.view === 'edit') return route.id ? `#/${route.type}/edit/${encodeURIComponent(route.id)}` : `#/${route.type}/new`;
  return `#/${route.type}`;
}

// The id an item will be saved under, from its data + slug.
export function idFor(type, data, slug) {
  const col = collections[type];
  if (col.idFor && data.date) return col.idFor(data, slug);
  return slug;
}

function freshEditor(type, item, today) {
  const col = collections[type];
  const data = {};
  for (const f of col.fields) {
    if (f.kind === 'markdown') continue;
    if (item) data[f.name] = item.data[f.name];
    else if (f.kind === 'date') data[f.name] = today;
    else if (f.kind === 'tags' || f.kind === 'refs' && !f.single) data[f.name] = [];
  }
  if (item) for (const [k, v] of Object.entries(item.data)) if (!(k in data)) data[k] = v;
  return {
    type,
    id: item?.id || null,
    from: item?.id || null,
    isNew: !item,
    slug: item ? item.id.split('/').pop().replace(/^\d{4}-/, '') : '',
    slugTouched: !!item,
    // Existing items keep their id (and URL) unless date or slug change: the
    // historical file names don't all match their dates.
    origDate: item?.data.date,
    origSlug: item ? item.id.split('/').pop().replace(/^\d{4}-/, '') : '',
    data,
    body: item?.body || '',
    dirty: false,
    problems: [],
    saving: false,
    previews: {}, // field → object URL for freshly cropped/uploaded files
  };
}

// News slugs strip the mmdd- prefix in the editor; put it back through idFor.
export function editorId(ed) {
  const col = collections[ed.type];
  if (!ed.isNew && ed.from && ed.data.date === ed.origDate && ed.slug === ed.origSlug) return ed.from;
  const slug = ed.slug || slugify(titleOf(ed.type, ed.data) || '') || 'untitled';
  if (col.idFor && ed.data.date) return col.idFor(ed.data, slug);
  return slug;
}

export function update(state, action) {
  switch (action.type) {
    case 'load':
      return tx({ ...state, loading: true }, async function* () {
        try {
          const s = await api.state();
          yield { type: 'loaded', state: s };
        } catch (err) {
          yield { type: 'fail', error: err.message };
        }
      });
    case 'loaded': {
      const next = { ...state, ...action.state, loading: false, error: null };
      // Opening an editor from the URL on first load.
      if (next.route.view === 'edit' && !next.editor) return update(next, { type: 'edit/open', collection: next.route.type, id: next.route.id });
      return tx(next);
    }
    case 'fail':
      return tx({ ...state, loading: false, error: action.error });
    case 'toast':
      return tx({ ...state, toast: action.message ? { message: action.message, kind: action.kind || 'info', at: Date.now() } : null },
        action.message ? async function* () { await sleep(4000); yield { type: 'toast/expire', at: Date.now() }; } : undefined);
    case 'toast/expire':
      return tx(state.toast && Date.now() - state.toast.at >= 3900 ? { ...state, toast: null } : state);

    // ── Routing ─────────────────────────────────────────────────────────────
    case 'navigate': {
      const route = action.route;
      if (route.view === 'edit') return update({ ...state, route, editor: null, announce: null }, { type: 'edit/open', collection: route.type, id: route.id });
      return tx({ ...state, route, editor: null, announce: null });
    }

    // ── Editor ──────────────────────────────────────────────────────────────
    case 'edit/open': {
      const col = action.collection;
      if (!action.id) return tx({ ...state, editor: freshEditor(col, null, state.today) });
      return tx({ ...state, editor: { ...freshEditor(col, null, state.today), loading: true, id: action.id, from: action.id, isNew: false } },
        async function* () {
          try {
            const item = await api.item(col, action.id);
            yield { type: 'edit/loaded', collection: col, item };
          } catch (err) {
            yield { type: 'toast', message: err.message, kind: 'error' };
            yield { type: 'navigate', route: { view: 'list', type: col } };
          }
        });
    }
    case 'edit/loaded':
      return tx({ ...state, editor: freshEditor(action.collection, action.item, state.today) });
    case 'edit/field': {
      const ed = state.editor;
      const data = { ...ed.data, [action.name]: action.value };
      let { slug, slugTouched } = ed;
      const titleField = ed.type === 'people' ? 'name' : 'title';
      if (action.name === titleField && !slugTouched) slug = slugify(action.value || '');
      const previews = action.preview !== undefined ? { ...ed.previews, [action.name]: action.preview } : ed.previews;
      return tx({ ...state, editor: { ...ed, data, slug, previews, dirty: true, problems: [] } });
    }
    case 'edit/body':
      return tx({ ...state, editor: { ...state.editor, body: action.value, dirty: true } });
    case 'edit/slug':
      return tx({ ...state, editor: { ...state.editor, slug: slugify(action.value), slugTouched: true, dirty: true } });
    case 'edit/save': {
      const ed = state.editor;
      const problems = validate(ed.type, ed.data);
      if (problems.length) return tx({ ...state, editor: { ...ed, problems } });
      const id = editorId(ed);
      return tx({ ...state, editor: { ...ed, saving: true, problems: [] }, busy: { ...state.busy, save: true } }, async function* () {
        try {
          const item = await api.save(ed.type, id, { data: ed.data, body: ed.body, from: ed.from });
          yield { type: 'edit/saved', item };
          yield { type: 'toast', message: `Saved ${collections[ed.type].singular} — preview rebuilding` };
          if (ed.isNew) location.hash = hashFor({ view: 'edit', type: ed.type, id: item.id });
        } catch (err) {
          yield { type: 'edit/failed', error: err.message };
        }
      });
    }
    case 'edit/saved': {
      const item = action.item;
      const ed = state.editor;
      // Field values are now real filenames; drop the upload tokens.
      const editor = { ...freshEditor(ed.type, item, state.today), previews: ed.previews };
      return tx({ ...state, editor, busy: { ...state.busy, save: false }, route: { view: 'edit', type: ed.type, id: item.id } }, async function* () {
        yield { type: 'refresh' };
      });
    }
    case 'edit/failed':
      return tx({ ...state, editor: { ...state.editor, saving: false, problems: [action.error] }, busy: { ...state.busy, save: false } });
    case 'edit/delete': {
      const ed = state.editor;
      return tx(state, async function* () {
        try {
          await api.remove(ed.type, ed.id);
          yield { type: 'toast', message: `Deleted ${collections[ed.type].singular}` };
          yield { type: 'refresh' };
          location.hash = hashFor({ view: 'list', type: ed.type });
        } catch (err) {
          yield { type: 'toast', message: err.message, kind: 'error' };
        }
      });
    }
    case 'refresh':
      return tx(state, async function* () {
        try {
          const s = await api.state();
          yield { type: 'refreshed', state: s };
        } catch { /* ignore */ }
      });
    case 'refreshed': {
      const { items, site, atproto, settings, lastBuild, lastPublish, today, deploy } = action.state;
      return tx({ ...state, items, site, atproto, settings, lastBuild, lastPublish, today, deploy });
    }

    // ── Build & publish ─────────────────────────────────────────────────────
    case 'build':
      return tx({ ...state, busy: { ...state.busy, build: true } }, async function* () {
        try { await api.build(); yield { type: 'toast', message: 'Preview rebuilt' }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
        yield { type: 'busy', key: 'build', value: false };
      });
    case 'publish':
      return tx({ ...state, busy: { ...state.busy, publish: true }, log: [] }, async function* () {
        try { const r = await api.publish(); yield { type: 'toast', message: r.summary, kind: 'success' }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
        yield { type: 'busy', key: 'publish', value: false };
        yield { type: 'refresh' };
      });
    case 'busy':
      return tx({ ...state, busy: { ...state.busy, [action.key]: action.value } });
    case 'settings/set-flag':
      return tx({ ...state, settings: { ...state.settings, [action.key]: action.value } }, async function* () {
        try { const s = await api.settings({ [action.key]: action.value }); yield { type: 'settings/set', settings: s }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
      });
    case 'settings/set':
      return tx({ ...state, settings: action.settings });

    // ── Server events ───────────────────────────────────────────────────────
    case 'sse': {
      const { name, payload } = action;
      if (name === 'built') return tx({ ...state, lastBuild: payload });
      if (name === 'published') return tx({ ...state, lastPublish: payload, log: [...state.log, `✓ ${payload.summary}`] });
      if (name === 'publish-log') return tx({ ...state, log: [...state.log.slice(-200), payload.line] });
      if (name === 'error') return update(state, { type: 'toast', message: `${payload.where}: ${payload.message}`, kind: 'error' });
      if (name === 'items-changed') return update(state, { type: 'refresh' });
      if (name === 'announced') return update(state, { type: 'toast', message: `Announced: ${payload.bskyWebUrl || payload.atUri}`, kind: 'success' });
      if (name === 'backfill') {
        if (payload.finished) return update({ ...state, backfill: { ...state.backfill, running: false, finished: true, done: payload.done, failed: payload.failed } }, { type: 'refresh' });
        return tx({ ...state, backfill: { ...(state.backfill || {}), running: true, ...payload, log: [...(state.backfill?.log || []).slice(-50), `${payload.status === 'failed' ? '✗' : payload.status === 'done' ? '✓' : '…'} ${payload.title}${payload.error ? ` — ${payload.error}` : ''}`] } });
      }
      return tx(state);
    }

    // ── Site settings ───────────────────────────────────────────────────────
    case 'site/save':
      return tx(state, async function* () {
        try { const site = await api.saveSite(action.site); yield { type: 'site/saved', site }; yield { type: 'toast', message: 'Site settings saved' }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
      });
    case 'site/saved':
      return tx({ ...state, site: action.site });

    // ── ATProto ─────────────────────────────────────────────────────────────
    case 'atproto/login':
      return tx({ ...state, busy: { ...state.busy, atproto: true } }, async function* () {
        try { const s = await api.atproto.login(action.creds); yield { type: 'atproto/status', status: s }; yield { type: 'toast', message: `Logged in as @${s.handle}`, kind: 'success' }; yield { type: 'refresh' }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
        yield { type: 'busy', key: 'atproto', value: false };
      });
    case 'atproto/logout':
      return tx(state, async function* () {
        const s = await api.atproto.logout();
        yield { type: 'atproto/status', status: s };
      });
    case 'atproto/status':
      return tx({ ...state, atproto: action.status });
    case 'atproto/publication':
      return tx({ ...state, busy: { ...state.busy, atproto: true } }, async function* () {
        try { const r = await api.atproto.publication(); yield { type: 'toast', message: `Publication record: ${r.uri}`, kind: 'success' }; yield { type: 'refresh' }; }
        catch (err) { yield { type: 'toast', message: err.message, kind: 'error' }; }
        yield { type: 'busy', key: 'atproto', value: false };
      });

    case 'atproto/backfill':
      return tx({ ...state, backfill: { running: true, log: [], step: 0, total: 0 } }, async function* () {
        try {
          const r = await api.atproto.backfill({ types: action.types, post: action.post });
          if (!r.queued) yield { type: 'toast', message: 'Nothing to backfill — every item already has a record' };
          yield { type: 'backfill/queued', queued: r.queued };
        } catch (err) {
          yield { type: 'toast', message: err.message, kind: 'error' };
          yield { type: 'backfill/queued', queued: 0 };
        }
      });
    case 'backfill/queued':
      return tx(action.queued ? { ...state, backfill: { ...state.backfill, total: action.queued } } : { ...state, backfill: null });

    // ── Announce (standard.site + Bluesky) ──────────────────────────────────
    case 'announce/open': {
      const ed = state.editor;
      return tx({ ...state, announce: { open: true, loading: true, text: '', post: true, repost: false, busy: false, result: null, error: null } }, async function* () {
        try { const p = await api.atproto.preview(ed.type, ed.id); yield { type: 'announce/preview', ...p }; }
        catch (err) { yield { type: 'announce/set', patch: { loading: false, error: err.message } }; }
      });
    }
    case 'announce/preview':
      return tx({ ...state, announce: { ...state.announce, loading: false, text: action.text, pageUrl: action.pageUrl } });
    case 'announce/set':
      return tx({ ...state, announce: { ...state.announce, ...action.patch } });
    case 'announce/close':
      return tx({ ...state, announce: null });
    case 'announce/go': {
      const ed = state.editor;
      const an = state.announce;
      return tx({ ...state, announce: { ...an, busy: true, error: null }, log: [] }, async function* () {
        try {
          const r = await api.atproto.publish(ed.type, ed.id, { post: an.post, text: an.text, repost: an.repost });
          yield { type: 'announce/set', patch: { busy: false, result: r } };
          yield { type: 'edit/open', collection: ed.type, id: ed.id };
          yield { type: 'toast', message: 'Published to ATProto', kind: 'success' };
        } catch (err) {
          yield { type: 'announce/set', patch: { busy: false, error: err.message } };
        }
      });
    }
    default:
      return tx(state);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const appStore = store(update, initialState);

// ── Derivations ──────────────────────────────────────────────────────────────
export const route = computed(() => appStore.get().route);
export const editor = computed(() => appStore.get().editor);
export const allTags = computed(() => {
  const s = appStore.get();
  const set = new Set();
  for (const list of Object.values(s.items)) for (const i of list) for (const t of i.data.tags || []) set.add(t);
  return [...set].sort();
});

export const send = (a) => appStore.send(a);

// Hash routing → store.
window.addEventListener('hashchange', () => send({ type: 'navigate', route: parseHash(location.hash) }));
