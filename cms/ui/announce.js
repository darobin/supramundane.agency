// <sm-announce>: confirm and edit the Bluesky post before publishing an item
// to standard.site (+ Bluesky).
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { base } from './styles.js';
import { appStore, send } from './store.js';

export class Announce extends SignalWatcher(LitElement) {
  static styles = [base, css`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 10; padding: 1rem; }
    .dialog { background: var(--panel); border-radius: var(--radius); padding: 1.5rem; width: 100%; max-width: 560px; max-height: 90vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    textarea { min-height: 9rem; }
    .count { text-align: right; font-size: 0.8rem; color: var(--muted); }
    .count.over { color: var(--danger); }
    .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    ol { padding-left: 1.2rem; font-size: 0.9rem; }
    .result a { word-break: break-all; }
  `];

  render() {
    const s = appStore.get();
    const an = s.announce;
    const ed = s.editor;
    if (!an) return '';
    const len = [...(an.text || '')].length;
    return html`<div class="backdrop" @click=${(e) => { if (e.target === e.currentTarget && !an.busy) send({ type: 'announce/close' }); }}>
      <div class="dialog">
        <h2>Publish “${ed.data.title}”</h2>
        ${an.result ? html`<div class="result">
            <p>Done. The page is live and the records exist:</p>
            <ul>
              <li>standard.site: <span class="mono">${an.result.atUri}</span></li>
              ${an.result.bskyWebUrl ? html`<li>Bluesky: <a href=${an.result.bskyWebUrl} target="_blank">${an.result.bskyWebUrl}</a></li>` : ''}
              <li>Page: <a href=${an.result.pageUrl} target="_blank">${an.result.pageUrl}</a></li>
            </ul>
            <div class="actions"><button class="primary" @click=${() => send({ type: 'announce/close' })}>Close</button></div>
          </div>`
        : html`
          <p class="muted">This will: push the site live, create a <span class="mono">site.standard.document</span> record as @${s.atproto.handle}${ed.data.atUri ? ' (updating the existing one)' : ''}, ${an.post && !ed.data.bskyUri ? 'post to Bluesky with a link card, ' : ''}then push again so the page links back to the record.</p>
          ${an.loading ? html`<p class="muted">Preparing…</p>` : html`
            ${!ed.data.bskyUri ? html`
              <label class="field"><span class="row"><input type="checkbox" .checked=${an.post} @change=${(e) => send({ type: 'announce/set', patch: { post: e.target.checked } })}> <span class="name" style="margin:0">Also post to Bluesky</span></span></label>
              ${an.post ? html`
                <label class="field"><span class="name">Post text</span>
                  <textarea .value=${an.text} @input=${(e) => send({ type: 'announce/set', patch: { text: e.target.value } })}></textarea>
                </label>
                <div class="count ${len > 300 ? 'over' : ''}">${len} / 300</div>
                <p class="muted" style="font-size:0.85rem">The link card uses the item's title, description, and image.</p>` : ''}`
              : html`<p class="muted">Already posted to Bluesky; only the standard.site record will be refreshed.</p>`}
          `}
          ${an.error ? html`<div class="problems">${an.error}</div>` : ''}
          <div class="actions">
            <button @click=${() => send({ type: 'announce/close' })} ?disabled=${an.busy}>Cancel</button>
            <button class="primary" @click=${() => send({ type: 'announce/go' })} ?disabled=${an.busy || an.loading || (an.post && len > 300)}>${an.busy ? 'Publishing…' : 'Publish'}</button>
          </div>`}
      </div>
    </div>`;
  }
}
customElements.define('sm-announce', Announce);
