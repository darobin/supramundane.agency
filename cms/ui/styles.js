// Shared styles for the admin components.
import { css } from 'lit';

export const base = css`
  :host { font: inherit; color: inherit; }
  * { box-sizing: border-box; }
  a { color: var(--accent-ink); text-decoration-thickness: 2px; }
  h1, h2, h3 { font-weight: 700; margin: 0 0 0.75rem 0; line-height: 1.1; letter-spacing: -0.01em; }
  h1 { font-size: 1.8rem; text-transform: uppercase; }
  h2 { font-size: 1.2rem; }
  h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.12em; font-family: var(--mono); font-weight: 700; }
  button, .button {
    font: inherit;
    font-weight: 700;
    border: 2px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    padding: 0.45rem 0.9rem;
    border-radius: 0;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    line-height: 1.2;
    transition: transform 0.05s, box-shadow 0.05s;
  }
  button:hover, .button:hover { box-shadow: 3px 3px 0 var(--line); transform: translate(-1px, -1px); }
  button:active, .button:active { box-shadow: none; transform: none; }
  button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
  button.primary, .button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.primary:hover { box-shadow: 3px 3px 0 var(--line); }
  button.danger { color: var(--danger); border-color: var(--danger); }
  button.link { border: none; background: none; padding: 0; color: var(--accent-ink); text-decoration: underline; font-weight: 400; }
  button.link:hover { box-shadow: none; transform: none; }
  input[type=text], input[type=url], input[type=date], input[type=number], input[type=password], input[type=email], textarea, select {
    font: inherit;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 2px solid var(--line);
    border-radius: 0;
    background: var(--panel);
    color: var(--ink);
  }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 3px 3px 0 var(--accent); }
  textarea { resize: vertical; min-height: 4rem; }
  label.field { display: block; margin-bottom: 1.25rem; }
  label.field > span.name, .field > .name { display: block; font-family: var(--mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 0.35rem; }
  .field .help { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }
  .field .req { color: var(--accent); }
  .muted { color: var(--muted); }
  .mono { font-family: var(--mono); font-size: 0.85em; }
  .row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .panel { background: var(--panel); border: 2px solid var(--line); padding: 1.25rem; box-shadow: var(--shadow); }
  .problems { background: #fff; border: 2px solid var(--danger); color: var(--danger); padding: 0.6rem 0.9rem; margin-bottom: 1rem; font-weight: 700; }
  .pill { display: inline-block; font-family: var(--mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.1rem 0.45rem; border: 1.5px solid var(--line); color: var(--ink); }
  .pill.today { background: var(--today); }
  .pill.ok { background: var(--accent); border-color: var(--accent); color: #fff; }
`;

// Styles for <sm-rich> (light DOM), included by any host that embeds one.
export const richText = css`
  .rich { border: 2px solid var(--line); background: var(--panel); }
  .rich:focus-within { border-color: var(--accent); box-shadow: 3px 3px 0 var(--accent); }
  .rich .toolbar { display: flex; flex-wrap: wrap; gap: 0.15rem; padding: 0.3rem; border-bottom: 2px solid var(--line); background: var(--panel); }
  .rich .toolbar button { border: 1.5px solid transparent; background: none; padding: 0.15rem 0.45rem; font-size: 0.8rem; min-width: 1.8rem; justify-content: center; font-weight: 700; }
  .rich .toolbar button:hover { border-color: var(--line); box-shadow: none; transform: none; }
  .rich .toolbar button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  .rich .toolbar .gap { width: 0.6rem; }
  .rich .surface { padding: 0.5rem 0.75rem; }
  .rich.block .prose { min-height: 14rem; }
  .rich.block.compact .prose { min-height: 4rem; }
  .rich.inline .prose { min-height: 2.6rem; }
  .rich .linkbar { display: flex; gap: 0.4rem; padding: 0.4rem; border-top: 2px solid var(--line); background: var(--panel); }
  .rich .linkbar input { flex: 1; }
  .prose { outline: none; line-height: 1.5; font-size: 0.95rem; }
  .prose > * { margin-top: 0.6em; margin-bottom: 0; }
  .prose > :first-child { margin-top: 0; }
  .prose h2, .prose h3 { margin: 1em 0 0.3em; line-height: 1.2; }
  .prose h2 { font-size: 1.25rem; }
  .prose h3 { font-size: 1.05rem; }
  .prose ul, .prose ol { padding-left: 1.4rem; margin: 0.4em 0; }
  .prose blockquote { border-left: 4px solid var(--ink); margin: 0.6em 0; padding: 0.1em 0 0.1em 0.8em; color: var(--muted); font-style: italic; }
  .prose code { font-family: var(--mono); font-size: 0.85em; background: var(--soft); padding: 0.1em 0.3em; }
  .prose pre { background: var(--soft); padding: 0.6rem; overflow: auto; }
  .prose a { color: var(--accent-ink); text-decoration: underline; }
  .prose hr { border: none; border-top: 2px solid var(--line); margin: 1em 0; }
  .prose img { max-width: 100%; }
  .prose p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted); float: left; pointer-events: none; height: 0; }
`;
