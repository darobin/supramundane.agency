// <sm-editor>: a form generated from the collection schema, with the news
// item flow front and centre: title → date → drop an image → describe → save.
// Widgets are value/setter based so they nest inside `list` fields.
import { LitElement, html, css, nothing } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { base, richText } from './styles.js';
import { appStore, send, allTags, editorId, hashFor } from './store.js';
import { api } from './api.js';
import { collections, titleOf } from '../../lib/schema.js';
import './image-crop.js';
import './fields.js';
import './rich.js';
import './announce.js';

export class Editor extends SignalWatcher(LitElement) {
  static styles = [base, richText, css`
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .head .actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 2rem; align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .side .panel { margin-bottom: 1.5rem; }
    .url { font-family: var(--mono); font-size: 0.85rem; color: var(--muted); word-break: break-all; }
    .url input { font-family: var(--mono); font-size: 0.85rem; padding: 0.2rem 0.4rem; width: auto; min-width: 12rem; border-width: 1.5px; }
    .dirty { color: var(--accent); font-family: var(--mono); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .cropped { max-width: 560px; }
    .cropped img { display: block; width: 100%; height: auto; border: 2px solid var(--line); }
    .cropped .row { margin-top: 0.4rem; }
    .readonly { font-size: 0.85rem; margin-bottom: 0.6rem; word-break: break-all; }
    .readonly .name { font-weight: 600; display: block; }
    .list-item { border: 2px solid var(--line); padding: 1rem 1rem 0; margin-bottom: 0.9rem; background: var(--panel); }
    .list-item .bar { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem; font-size: 0.85rem; }
    .list-item .bar strong { flex: 1; }
    .list-item .bar button { padding: 0.2rem 0.5rem; font-size: 0.8rem; }
    .list-add { margin-bottom: 0.5rem; }
  `];

  render() {
    const s = appStore.get();
    const ed = s.editor;
    if (!ed) return nothing;
    if (ed.loading) return html`<p class="muted">Loading…</p>`;
    const col = collections[ed.type];
    const schema = s.schema[ed.type];
    const id = editorId(ed);
    const url = `${col.urlPrefix}${id}/`;
    const title = titleOf(ed.type, ed.data);
    const announceable = col.fields.some((f) => f.name === 'atUri');
    const main = schema.fields.filter((f) => !['readonly'].includes(f.kind) && !SIDE.has(f.name));
    const side = schema.fields.filter((f) => f.kind !== 'readonly' && SIDE.has(f.name));
    const ro = schema.fields.filter((f) => f.kind === 'readonly' && ed.data[f.name]);
    // Where this item's existing assets can be previewed from.
    const assetBase = ed.from ? `${s.previewUrl}${col.urlPrefix}${ed.from.split('/').slice(0, -1).map((p) => `${p}/`).join('')}` : '';
    const top = (f) => this._field(f, ed.data[f.name], (value, preview) => send({ type: 'edit/field', name: f.name, value, preview }), { ed, s, assetBase, preview: ed.previews[f.name], key: f.name });

    return html`
      <div class="head">
        <div>
          <h1>${ed.isNew ? `New ${col.singular}` : title || col.singular}</h1>
          <div class="url">
            ${col.urlPrefix}${col.idFor ? id.replace(/[^/]*$/, '').concat(id.split('/').pop().slice(0, 5)) : ''}<input type="text" .value=${ed.slug} placeholder="slug" @input=${(e) => send({ type: 'edit/slug', value: e.target.value })}>/
            ${!ed.isNew && !ed.dirty ? html` <a href="${s.previewUrl}${url}" target="_blank">preview ↗</a>` : ''}
          </div>
        </div>
        <div class="actions">
          ${ed.dirty ? html`<span class="dirty">unsaved changes</span>` : ''}
          ${!ed.isNew ? html`<button class="danger" @click=${this._delete}>Delete</button>` : ''}
          <a class="button" href=${hashFor({ view: 'list', type: ed.type })}>Back</a>
          <button class="primary" ?disabled=${ed.saving} @click=${() => send({ type: 'edit/save' })}>${ed.saving ? 'Saving…' : ed.isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
      ${ed.problems.length ? html`<div class="problems">${ed.problems.map((p) => html`<div>${p}</div>`)}</div>` : ''}
      <div class="grid">
        <div class="panel main">${main.map(top)}</div>
        <div class="side">
          ${side.length ? html`<div class="panel">${side.map(top)}</div>` : ''}
          ${announceable && !ed.isNew ? html`<div class="panel">
            <h3>Announce</h3>
            ${ro.map((f) => html`<div class="readonly"><span class="name">${f.label || f.name}</span>${this._roValue(f, ed)}</div>`)}
            ${!s.atproto.loggedIn ? html`<p class="muted">Log in on the <a href="#/atproto">ATProto page</a> to publish this to standard.site and Bluesky.</p>`
              : !s.site.publicationUri ? html`<p class="muted">Create the publication record on the <a href="#/atproto">ATProto page</a> first.</p>`
              : ed.data.atUri ? html`<p class="muted">Published to ATProto${ed.data.bskyUri ? ' and posted to Bluesky' : ''}.</p>
                  <button @click=${() => send({ type: 'announce/open' })} ?disabled=${ed.dirty}>Update record${ed.data.bskyUri ? '' : ' / post…'}</button>`
              : html`<button class="primary" @click=${() => send({ type: 'announce/open' })} ?disabled=${ed.dirty} title=${ed.dirty ? 'Save first' : ''}>Publish to standard.site & Bluesky…</button>`}
          </div>` : ''}
        </div>
      </div>
      ${s.announce ? html`<sm-announce></sm-announce>` : ''}
    `;
  }

  _roValue(f, ed) {
    const v = ed.data[f.name];
    if (f.name === 'bskyUri') {
      const m = v.match(/^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/);
      return m ? html`<a href="https://bsky.app/profile/${m[1]}/post/${m[2]}" target="_blank">view post ↗</a>` : html`<span class="mono">${v}</span>`;
    }
    return html`<span class="mono">${v}</span>`;
  }

  // One field. `set(value, preview?)` writes back; ctx carries the editor
  // state, asset base URL, a fresh-upload preview, and a unique key.
  _field(f, v, set, ctx) {
    const { ed, s, assetBase, key } = ctx;
    const label = f.label || f.name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const head = html`<span class="name">${label}${f.required ? html` <span class="req">*</span>` : ''}</span>`;
    const help = f.help ? html`<div class="help">${f.help}</div>` : '';
    switch (f.kind) {
      case 'string':
        return html`<label class="field">${head}<input type="text" .value=${v || ''} @input=${(e) => set(e.target.value)}>${help}</label>`;
      case 'url':
        return html`<label class="field">${head}<input type="url" .value=${v || ''} @input=${(e) => set(e.target.value)}>${help}</label>`;
      case 'number':
        return html`<label class="field">${head}<input type="number" .value=${v ?? ''} @input=${(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}>${help}</label>`;
      case 'date':
        return html`<label class="field">${head}<input type="date" .value=${v || ''} @input=${(e) => set(e.target.value)}>${help}</label>`;
      case 'boolean':
        return html`<label class="field"><span class="row"><input type="checkbox" .checked=${!!v} @change=${(e) => set(e.target.checked)}> <span class="name" style="margin:0">${label}</span></span>${help}</label>`;
      case 'text':
        return html`<div class="field">${head}<sm-rich mode="inline" .value=${v || ''} @change=${(e) => set(e.detail.value)}></sm-rich>${help}</div>`;
      case 'markdown':
        return html`<div class="field">${head}<sm-rich mode="block" .value=${ed.body} @change=${(e) => send({ type: 'edit/body', value: e.detail.value })}></sm-rich>${help}</div>`;
      case 'tags':
        return html`<div class="field">${head}<sm-tags .value=${v || []} .suggestions=${allTags.get()} @change=${(e) => set(e.detail.value)}></sm-tags>${help}</div>`;
      case 'refs': {
        const opts = (s.items[f.ref] || []).map((i) => ({ id: i.id, title: i.title }));
        return html`<div class="field">${head}<sm-refs .value=${v} .options=${opts} ?single=${!!f.single} placeholder=${label.toLowerCase()} @change=${(e) => set(e.detail.value)}></sm-refs>${help}</div>`;
      }
      case 'image': {
        const preview = ctx.preview;
        const current = preview || (v && !String(v).startsWith('upload:') && assetBase ? `${assetBase}${v}` : '');
        const replacing = this._replacing?.[key];
        return html`<div class="field">${head}
          ${current && !replacing
            ? html`<div class="cropped"><img src=${current} alt=""><div class="row"><button @click=${() => { this._replacing = { ...(this._replacing || {}), [key]: true }; this.requestUpdate(); }}>Replace image</button>${preview ? html`<span class="pill ok">new crop, saved with the item</span>` : ''}</div></div>`
            : html`<sm-image-crop width=${f.size.width} height=${f.size.height} current=${current || ''}
                @crop=${(e) => this._upload(key, e.detail, set)}></sm-image-crop>`}
          ${help}</div>`;
      }
      case 'file': {
        const isUpload = v && String(v).startsWith('upload:');
        const currentUrl = v && !isUpload && assetBase ? `${assetBase}${v}` : '';
        return html`<div class="field">${head}<sm-file-drop accept=${f.accept || ''} current=${v && !isUpload ? v : ''} currentUrl=${currentUrl} pending=${isUpload ? 'new file, saved with the item' : ''} @file=${(e) => this._upload(key, e.detail, set)}></sm-file-drop>${help}</div>`;
      }
      case 'list': {
        const items = Array.isArray(v) ? v : [];
        const setItems = (next) => set(next);
        const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
        const move = (i, d) => { const n = [...items]; const [it] = n.splice(i, 1); n.splice(i + d, 0, it); setItems(n); };
        return html`<div class="field">${head}${help}
          ${items.map((it, i) => html`<div class="list-item">
            <div class="bar"><strong>${label.replace(/s$/, '')} ${i + 1}</strong>
              <button title="move up" ?disabled=${i === 0} @click=${() => move(i, -1)}>↑</button>
              <button title="move down" ?disabled=${i === items.length - 1} @click=${() => move(i, 1)}>↓</button>
              <button class="danger" @click=${() => setItems(items.filter((_, j) => j !== i))}>Remove</button>
            </div>
            ${f.fields.map((sf) => this._field(sf, it?.[sf.name], (value, preview) => update(i, { [sf.name]: value }), { ...ctx, key: `${key}.${i}.${sf.name}`, preview: undefined }))}
          </div>`)}
          <button class="list-add" @click=${() => setItems([...items, {}])}>+ Add ${f.itemLabel || 'item'}</button>
        </div>`;
      }
      default:
        return nothing;
    }
  }

  async _upload(key, { blob, preview, filename }, set) {
    try {
      const { token } = await api.upload(blob, filename);
      set(token, preview);
      if (this._replacing) { delete this._replacing[key]; this.requestUpdate(); }
    } catch (err) {
      send({ type: 'toast', message: `Upload failed: ${err.message}`, kind: 'error' });
    }
  }

  _delete() {
    const ed = appStore.get().editor;
    if (confirm(`Delete this ${collections[ed.type].singular}? This removes the file and its assets.`)) send({ type: 'edit/delete' });
  }
}

// Fields that go in the right-hand column.
const SIDE = new Set(['tags', 'people', 'video', 'report', 'location', 'event', 'publisher', 'order', 'website', 'bluesky', 'email', 'nav', 'link']);

customElements.define('sm-editor', Editor);
