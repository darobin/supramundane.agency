// <sm-app>: shell — sidebar, publish controls, routing to the views.
import { LitElement, html, css, nothing } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { base } from './styles.js';
import { appStore, send, hashFor } from './store.js';
import { api } from './api.js';
import { collections } from '../../lib/schema.js';
import './list.js';
import './editor.js';
import './site.js';

export class App extends SignalWatcher(LitElement) {
  static styles = [base, css`
    :host { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; }
    @media (max-width: 800px) { :host { grid-template-columns: 1fr; } aside { position: static !important; height: auto !important; } }
    aside { background: var(--ink); color: #ddd; padding: 1.25rem 1rem; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 1rem; }
    aside .brand { font-family: "Cormorant", Georgia, serif; font-size: 1.35rem; color: #fff; text-decoration: none; letter-spacing: 0.02em; }
    aside .brand em { font-style: italic; }
    aside nav a { display: block; color: #cfcfcf; text-decoration: none; padding: 0.4rem 0.6rem; border-radius: var(--radius); font-size: 0.95rem; }
    aside nav a:hover { background: rgba(255,255,255,0.08); color: #fff; }
    aside nav a.active { background: var(--accent); color: #fff; }
    aside nav a .n { float: right; opacity: 0.6; font-size: 0.8rem; }
    aside hr { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 0.25rem 0; }
    aside .grow { flex: 1; }
    .publish { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem; color: #aaa; }
    .publish button { width: 100%; justify-content: center; }
    .publish button.primary { background: var(--accent); border-color: var(--accent); }
    .publish label { display: flex; gap: 0.4rem; align-items: center; cursor: pointer; }
    .publish .status { line-height: 1.4; }
    .publish .status strong { color: #eee; font-weight: 500; }
    main { padding: 1.5rem 2rem 4rem; max-width: 1100px; width: 100%; }
    .toast { position: fixed; bottom: 1.25rem; right: 1.25rem; background: var(--ink); color: #fff; padding: 0.7rem 1rem; border-radius: var(--radius); box-shadow: 0 6px 24px rgba(0,0,0,0.25); max-width: 420px; z-index: 20; font-size: 0.9rem; }
    .toast.error { background: var(--danger); }
    .toast.success { background: var(--accent-ink); }
    .log { font-family: var(--mono); font-size: 0.7rem; color: #999; max-height: 6rem; overflow: auto; white-space: pre-wrap; }
  `];

  connectedCallback() {
    super.connectedCallback();
    send({ type: 'load' });
    this._es = api.events((name, payload) => send({ type: 'sse', name, payload }));
    this._onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (appStore.get().editor) send({ type: 'edit/save' }); }
    };
    window.addEventListener('keydown', this._onKey);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._es?.close();
    window.removeEventListener('keydown', this._onKey);
  }

  render() {
    const s = appStore.get();
    if (s.loading) return html`<aside></aside><main><p class="muted">Loading…</p></main>`;
    if (s.error) return html`<aside></aside><main><div class="problems">${s.error}</div><button @click=${() => send({ type: 'load' })}>Retry</button></main>`;
    const r = s.route;
    const active = (view, type) => (r.view === view && (!type || r.type === type)) || (view === 'list' && r.view === 'edit' && r.type === type) ? 'active' : '';
    return html`
      <aside>
        <a class="brand" href="#/">supramundane <em>agency</em>.</a>
        <nav>
          ${Object.entries(collections).map(([type, col]) => html`
            <a class=${active('list', type)} href=${hashFor({ view: 'list', type })}>${col.label} <span class="n">${(s.items[type] || []).length}</span></a>`)}
          <hr>
          <a class=${active('site')} href="#/site">Site settings</a>
          <a class=${active('atproto')} href="#/atproto">ATProto ${s.atproto.loggedIn ? html`<span class="n">@${s.atproto.handle}</span>` : html`<span class="n">not logged in</span>`}</a>
          <hr>
          <a href=${s.previewUrl} target="_blank">Preview site ↗</a>
        </nav>
        <div class="grow"></div>
        <div class="publish">
          <button class="primary" ?disabled=${s.busy.publish} @click=${() => send({ type: 'publish' })}>${s.busy.publish ? 'Publishing…' : 'Publish site'}</button>
          <label><input type="checkbox" .checked=${s.settings.autoPublish} @change=${(e) => send({ type: 'settings/autoPublish', value: e.target.checked })}> auto-publish on save</label>
          <div class="status">
            ${s.lastBuild ? html`preview built <strong>${ago(s.lastBuild.at)}</strong><br>` : ''}
            ${s.lastPublish ? html`live since <strong>${ago(s.lastPublish.at)}</strong> (${s.lastPublish.changed} changes)` : html`not published this session`}
            ${s.deploy?.host ? html`<br>→ ${s.deploy.target}` : html`<br><span style="color:var(--today)">SUPRAMUNDANE not set — cannot publish</span>`}
          </div>
          ${s.log.length ? html`<div class="log">${s.log.slice(-8).join('\n')}</div>` : ''}
        </div>
      </aside>
      <main>
        ${r.view === 'list' ? html`<sm-list></sm-list>`
          : r.view === 'edit' ? html`<sm-editor></sm-editor>`
          : r.view === 'site' ? html`<sm-site></sm-site>`
          : r.view === 'atproto' ? html`<sm-atproto></sm-atproto>`
          : nothing}
      </main>
      ${s.toast ? html`<div class="toast ${s.toast.kind}">${s.toast.message}</div>` : ''}
    `;
  }
}

function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

customElements.define('sm-app', App);
