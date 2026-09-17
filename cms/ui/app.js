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
    :host { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    @media (max-width: 800px) { :host { grid-template-columns: 1fr; } aside { position: static !important; height: auto !important; border-right: none !important; border-bottom: 2px solid var(--line); } }
    aside { background: var(--panel); color: var(--ink); padding: 1.25rem 1rem; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 1rem; border-right: 2px solid var(--line); }
    aside .brand { font-family: "Cormorant", Georgia, serif; font-size: 1.5rem; color: var(--ink); text-decoration: none; letter-spacing: 0.02em; line-height: 1.1; }
    aside .brand em { font-style: italic; }
    aside .brand small { display: block; font-family: var(--mono); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.3rem; color: var(--muted); }
    aside nav { display: flex; flex-direction: column; gap: 2px; }
    aside nav a { display: block; color: var(--ink); text-decoration: none; padding: 0.45rem 0.6rem; font-weight: 700; border: 2px solid transparent; }
    aside nav a:hover { border-color: var(--line); }
    aside nav a.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    aside nav a .n { float: right; font-family: var(--mono); font-size: 0.75rem; font-weight: 400; opacity: 0.7; }
    aside nav a.active .n { opacity: 1; }
    aside hr { border: none; border-top: 2px solid var(--line); margin: 0.5rem 0; }
    aside .grow { flex: 1; }
    .publish { display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.8rem; color: var(--muted); }
    .publish button { width: 100%; justify-content: center; }
    .publish label { display: flex; gap: 0.4rem; align-items: center; cursor: pointer; color: var(--ink); }
    .publish .status { line-height: 1.5; font-family: var(--mono); font-size: 0.7rem; }
    .publish .status strong { color: var(--ink); }
    main { padding: 2rem 2.5rem 5rem; width: 100%; }
    .toast { position: fixed; bottom: 1.25rem; right: 1.25rem; background: var(--ink); color: #fff; padding: 0.8rem 1.1rem; box-shadow: 4px 4px 0 var(--accent); max-width: 460px; z-index: 20; font-weight: 700; }
    .toast.error { background: var(--danger); box-shadow: 4px 4px 0 var(--ink); }
    .toast.success { background: var(--accent); box-shadow: 4px 4px 0 var(--ink); }
    .log { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); max-height: 6rem; overflow: auto; white-space: pre-wrap; border-top: 2px solid var(--line); padding-top: 0.4rem; }
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
        <a class="brand" href="#/">supramundane <em>agency</em>.<small>content</small></a>
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
          <label><input type="checkbox" .checked=${s.settings.autoPublish} @change=${(e) => send({ type: 'settings/set-flag', key: 'autoPublish', value: e.target.checked })}> auto-publish on save</label>
          <label title="New news items are pushed live, recorded on standard.site, and posted to Bluesky as soon as they are created"><input type="checkbox" .checked=${s.settings.autoAnnounce} ?disabled=${!s.atproto.loggedIn || !s.site.publicationUri} @change=${(e) => send({ type: 'settings/set-flag', key: 'autoAnnounce', value: e.target.checked })}> auto-announce new news</label>
          <div class="status">
            ${s.lastBuild ? html`preview built <strong>${ago(s.lastBuild.at)}</strong><br>` : ''}
            ${s.lastPublish ? html`live since <strong>${ago(s.lastPublish.at)}</strong> (${s.lastPublish.changed} changes)` : html`not published this session`}
            ${s.deploy?.host ? html`<br>→ ${s.deploy.target}` : html`<br><span style="color:var(--danger)">SUPRAMUNDANE not set — cannot publish</span>`}
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
