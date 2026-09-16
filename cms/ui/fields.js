// Field widgets used by the editor: file drop, tags, references.
import { LitElement, html, css } from 'lit';
import { base } from './styles.js';

export class FileDrop extends LitElement {
  static properties = {
    accept: { type: String },
    current: { type: String },     // existing filename
    currentUrl: { type: String },  // where it can be opened
    _over: { state: true },
    _busy: { state: true },
    _pending: { state: true },
  };
  static styles = [base, css`
    .zone {
      border: 2px dashed var(--line); border-radius: var(--radius); padding: 1rem; text-align: center;
      color: var(--muted); font-size: 0.9rem; cursor: pointer; background: var(--panel);
    }
    .zone.over { border-color: var(--accent); background: #eaf5ec; }
    .zone strong { color: var(--ink); }
    .current { margin-top: 0.4rem; font-size: 0.85rem; }
    input[type=file] { display: none; }
  `];
  render() {
    return html`
      <div class="zone ${this._over ? 'over' : ''}"
        @dragover=${(e) => { e.preventDefault(); this._over = true; }}
        @dragleave=${() => { this._over = false; }}
        @drop=${(e) => { e.preventDefault(); this._over = false; const f = e.dataTransfer.files[0]; if (f) this._pick(f); }}
        @click=${() => this.renderRoot.querySelector('input').click()}>
        ${this._busy ? 'Uploading…' : html`<strong>Drop a file here</strong> or click to choose${this.accept ? html` <span class="mono">(${this.accept})</span>` : ''}`}
      </div>
      ${this._pending ? html`<div class="current">Ready: <span class="mono">${this._pending}</span> — saved with the item</div>`
        : this.current ? html`<div class="current">Current: ${this.currentUrl ? html`<a href=${this.currentUrl} target="_blank" class="mono">${this.current}</a>` : html`<span class="mono">${this.current}</span>`}</div>` : ''}
      <input type="file" accept=${this.accept || ''} @change=${(e) => { const f = e.target.files[0]; if (f) this._pick(f); e.target.value = ''; }}>
    `;
  }
  _pick(file) {
    this._pending = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
    this.dispatchEvent(new CustomEvent('file', { detail: { blob: file, filename: file.name }, bubbles: true, composed: true }));
  }
}
customElements.define('sm-file-drop', FileDrop);

export class Tags extends LitElement {
  static properties = { value: { type: Array }, suggestions: { type: Array }, _text: { state: true } };
  static styles = [base, css`
    .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.4rem; }
    .chip { background: var(--line); border-radius: 999px; padding: 0.1rem 0.3rem 0.1rem 0.7rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.2rem; }
    .chip button { border: none; background: none; padding: 0 0.3rem; cursor: pointer; color: var(--muted); font-size: 1rem; line-height: 1; }
    .suggest { margin-top: 0.3rem; font-size: 0.8rem; color: var(--muted); }
    .suggest button { border: none; background: none; padding: 0 0.2rem; color: var(--accent-ink); cursor: pointer; font-size: inherit; text-decoration: underline; }
  `];
  constructor() { super(); this.value = []; this.suggestions = []; this._text = ''; }
  render() {
    const v = this.value || [];
    const sugg = (this.suggestions || []).filter((s) => !v.includes(s) && (!this._text || s.startsWith(this._text.toLowerCase()))).slice(0, 12);
    return html`
      <div class="chips">${v.map((t) => html`<span class="chip">${t}<button title="remove" @click=${() => this._set(v.filter((x) => x !== t))}>×</button></span>`)}</div>
      <input type="text" placeholder="add a tag, press Enter or comma" .value=${this._text}
        @input=${(e) => { this._text = e.target.value; }}
        @keydown=${(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); this._add(); } else if (e.key === 'Backspace' && !this._text && v.length) this._set(v.slice(0, -1)); }}
        @blur=${this._add}>
      ${sugg.length ? html`<div class="suggest">${sugg.map((s) => html`<button @click=${() => this._set([...v, s])}>${s}</button>`)}</div>` : ''}
    `;
  }
  _add() {
    const t = this._text.trim().replace(/,$/, '').toLowerCase();
    this._text = '';
    if (t && !(this.value || []).includes(t)) this._set([...(this.value || []), t]);
  }
  _set(value) {
    this.value = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true, composed: true }));
  }
}
customElements.define('sm-tags', Tags);

// Pick one or many items from another collection.
export class Refs extends LitElement {
  static properties = { value: {}, options: { type: Array }, single: { type: Boolean }, placeholder: { type: String } };
  static styles = [base, css`
    .list { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
    label { display: inline-flex; gap: 0.35rem; align-items: center; font-size: 0.9rem; cursor: pointer; }
  `];
  constructor() { super(); this.options = []; }
  render() {
    const opts = this.options || [];
    if (!opts.length) return html`<span class="muted">Nothing to pick from yet.</span>`;
    if (this.single) {
      return html`<select .value=${this.value || ''} @change=${(e) => this._emit(e.target.value || undefined)}>
        <option value="">— ${this.placeholder || 'none'} —</option>
        ${opts.map((o) => html`<option value=${o.id} ?selected=${o.id === this.value}>${o.title}</option>`)}
      </select>`;
    }
    const v = this.value || [];
    return html`<div class="list">${opts.map((o) => html`
      <label><input type="checkbox" .checked=${v.includes(o.id)}
        @change=${(e) => this._emit(e.target.checked ? [...v, o.id] : v.filter((x) => x !== o.id))}> ${o.title}</label>`)}</div>`;
  }
  _emit(value) {
    this.value = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true, composed: true }));
  }
}
customElements.define('sm-refs', Refs);
