// <sm-site>: site-wide settings. <sm-atproto>: the agency account, the
// standard.site publication, and how the domain becomes a handle.
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { base } from './styles.js';
import { appStore, send } from './store.js';

export class Site extends SignalWatcher(LitElement) {
  static properties = { _draft: { state: true } };
  static styles = [base, css`
    .panel { max-width: 720px; }
    .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `];
  render() {
    const s = appStore.get();
    const site = this._draft || s.site;
    const set = (k, v) => { this._draft = { ...site, [k]: v }; };
    return html`<h1>Site settings</h1>
      <div class="panel">
        ${s.siteFields.map((f) => {
          const label = f.label || f.name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
          const help = f.help ? html`<div class="help">${f.help}</div>` : '';
          if (f.kind === 'readonly') return html`<div class="field"><span class="name">${label}</span><span class="mono">${site[f.name] || html`<span class="muted">not set</span>`}</span>${help}</div>`;
          if (f.kind === 'text') return html`<label class="field"><span class="name">${label}</span><textarea rows="2" .value=${site[f.name] || ''} @input=${(e) => set(f.name, e.target.value)}></textarea>${help}</label>`;
          return html`<label class="field"><span class="name">${label}</span><input type=${f.kind === 'url' ? 'url' : 'text'} .value=${site[f.name] || ''} @input=${(e) => set(f.name, e.target.value)}>${help}</label>`;
        })}
        <div class="actions">
          <button class="primary" ?disabled=${!this._draft} @click=${() => { send({ type: 'site/save', site: this._draft }); this._draft = null; }}>Save</button>
        </div>
      </div>`;
  }
}
customElements.define('sm-site', Site);

export class Atproto extends SignalWatcher(LitElement) {
  static properties = { _handle: { state: true }, _password: { state: true } };
  static styles = [base, css`
    .panel { max-width: 720px; margin-bottom: 1rem; }
    .who { display: flex; gap: 0.75rem; align-items: center; }
    .who img { width: 48px; height: 48px; border-radius: 50%; }
    .who .handle { font-weight: 600; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; font-size: 0.9rem; }
    dt { color: var(--muted); }
    dd { margin: 0; word-break: break-all; }
    code { font-family: var(--mono); font-size: 0.85em; background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; }
  `];
  constructor() { super(); this._handle = 'supramundane.agency'; this._password = ''; }
  render() {
    const s = appStore.get();
    const a = s.atproto;
    const domain = (s.site.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    return html`<h1>ATProto</h1>
      <div class="panel">
        <h3>Account</h3>
        ${a.loggedIn ? html`
          <div class="who">
            ${a.avatar ? html`<img src=${a.avatar} alt="">` : ''}
            <div><div class="handle">@${a.handle}</div><div class="mono muted">${a.did}</div></div>
            <span style="flex:1"></span>
            <button @click=${() => send({ type: 'atproto/logout' })}>Log out</button>
          </div>`
        : html`
          <p class="muted">Log in with the agency account and an <a href="https://bsky.app/settings/app-passwords" target="_blank">app password</a>. The session is kept in <code>.cms/</code> (git-ignored) so you only do this once.</p>
          <form @submit=${(e) => { e.preventDefault(); send({ type: 'atproto/login', creds: { identifier: this._handle, password: this._password } }); this._password = ''; }}>
            <label class="field"><span class="name">Handle or DID</span><input type="text" .value=${this._handle} @input=${(e) => { this._handle = e.target.value; }} autocomplete="username"></label>
            <label class="field"><span class="name">App password</span><input type="password" .value=${this._password} @input=${(e) => { this._password = e.target.value; }} autocomplete="current-password"></label>
            <button class="primary" type="submit" ?disabled=${s.busy.atproto || !this._handle || !this._password}>${s.busy.atproto ? 'Logging in…' : 'Log in'}</button>
          </form>`}
      </div>

      <div class="panel">
        <h3>standard.site publication</h3>
        ${s.site.publicationUri
          ? html`<dl><dt>record</dt><dd class="mono">${s.site.publicationUri}</dd><dt>served at</dt><dd><code>${s.site.url}.well-known/site.standard.publication</code></dd></dl>
              <p><button ?disabled=${!a.loggedIn || s.busy.atproto} @click=${() => send({ type: 'atproto/publication' })}>Update record from site settings</button></p>`
          : html`<p class="muted">One record describes the site as a publication; every news item and report then gets a <code>site.standard.document</code> record pointing to it, and its page links back with <code>&lt;link rel="site.standard.document"&gt;</code>.</p>
              <button class="primary" ?disabled=${!a.loggedIn || s.busy.atproto} @click=${() => send({ type: 'atproto/publication' })}>Create publication record</button>`}
      </div>

      <div class="panel">
        <h3>Domain as handle</h3>
        ${s.site.atprotoDid
          ? html`<p>The site serves <code>/.well-known/atproto-did</code> with <code>${s.site.atprotoDid}</code>. Once it is live, set the account's handle to <strong>${domain}</strong> in Bluesky's settings (Change handle → I have my own domain → No DNS panel).</p>`
          : html`<p class="muted">Log in once and the DID is recorded here; the site then serves <code>/.well-known/atproto-did</code> so <strong>${domain}</strong> can be the account's handle.</p>`}
      </div>`;
  }
}
customElements.define('sm-atproto', Atproto);
