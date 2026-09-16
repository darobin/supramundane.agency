// <sm-list>: the items of one collection. News is grouped the way the site
// shows it (Today / Upcoming / Previously) so what's live is obvious.
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { base } from './styles.js';
import { appStore, hashFor } from './store.js';
import { collections } from '../../lib/schema.js';

export class List extends SignalWatcher(LitElement) {
  static styles = [base, css`
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    th, td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--line); vertical-align: middle; }
    th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    tr.today td { background: #fff8e6; }
    td.thumb { width: 88px; }
    td.thumb img { display: block; width: 80px; height: auto; border-radius: 3px; }
    td.thumb img.square { width: 44px; }
    td.date { white-space: nowrap; font-family: var(--mono); font-size: 0.85rem; color: var(--muted); }
    td.title a { color: inherit; text-decoration: none; font-weight: 600; }
    td.title a:hover { text-decoration: underline; }
    td.title .desc { display: block; color: var(--muted); font-size: 0.85rem; font-weight: normal; margin-top: 0.15rem; }
    td.flags { white-space: nowrap; text-align: right; }
    h3 { margin: 1.5rem 0 0.5rem; }
    .empty { color: var(--muted); padding: 2rem; text-align: center; background: var(--panel); border: 1px dashed var(--line); border-radius: var(--radius); }
  `];

  render() {
    const s = appStore.get();
    const type = s.route.type;
    const col = collections[type];
    const items = s.items[type] || [];
    return html`
      <div class="head">
        <h1>${col.label} <span class="muted">(${items.length})</span></h1>
        <a class="button primary" href=${hashFor({ view: 'edit', type, id: null })}>+ New ${col.singular}</a>
      </div>
      ${!items.length ? html`<div class="empty">No ${col.label.toLowerCase()} yet. Create the first ${col.singular}.</div>`
        : type === 'news' ? this._grouped(items, s) : this._table(items, s, type)}
    `;
  }

  _grouped(items, s) {
    const today = s.today;
    const groups = [
      ['Today', items.filter((i) => i.data.date === today)],
      ['Upcoming', items.filter((i) => i.data.date > today).sort((a, b) => a.data.date.localeCompare(b.data.date))],
      ['Previously', items.filter((i) => i.data.date < today)],
    ];
    return groups.filter(([, list]) => list.length).map(([label, list]) => html`<h3>${label}</h3>${this._table(list, s, 'news')}`);
  }

  _table(items, s, type) {
    const col = collections[type];
    const imgField = col.fields.find((f) => f.kind === 'image')?.name;
    return html`<table>
      <tbody>
      ${items.map((i) => html`<tr class=${i.data.date === s.today ? 'today' : ''}>
        <td class="thumb">${imgField && i.data[imgField] ? html`<img class=${type === 'people' ? 'square' : ''} src="${s.previewUrl}${i.urlDir}${i.data[imgField]}" alt="">` : ''}</td>
        <td class="title"><a href=${hashFor({ view: 'edit', type, id: i.id })}>${i.title}</a>
          ${i.data.description ? html`<span class="desc">${i.data.description}</span>` : i.data.role ? html`<span class="desc">${i.data.role}</span>` : ''}</td>
        ${col.dated ? html`<td class="date">${i.data.date}</td>` : ''}
        <td class="flags">
          ${i.data.date === s.today ? html`<span class="pill today">today</span> ` : ''}
          ${i.data.atUri ? html`<span class="pill ok" title=${i.data.atUri}>standard.site</span> ` : ''}
          ${i.data.bskyUri ? html`<span class="pill ok">bluesky</span> ` : ''}
          <a class="mono muted" href="${s.previewUrl}${i.url}" target="_blank" title="preview">↗</a>
        </td>
      </tr>`)}
      </tbody>
    </table>`;
  }
}
customElements.define('sm-list', List);
