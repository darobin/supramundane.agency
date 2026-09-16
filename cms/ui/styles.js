// Shared styles for the admin components.
import { css } from 'lit';

export const base = css`
  :host { font: inherit; color: inherit; }
  * { box-sizing: border-box; }
  a { color: var(--accent-ink); }
  h1, h2, h3 { font-weight: 600; margin: 0 0 0.75rem 0; line-height: 1.2; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; }
  h3 { font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  button, .button {
    font: inherit;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    padding: 0.45rem 0.9rem;
    border-radius: var(--radius);
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    line-height: 1.2;
  }
  button:hover, .button:hover { border-color: var(--muted); }
  button:disabled { opacity: 0.5; cursor: default; }
  button.primary, .button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  button.primary:hover { background: var(--accent-ink); }
  button.danger { color: var(--danger); }
  button.link { border: none; background: none; padding: 0; color: var(--accent-ink); text-decoration: underline; }
  input[type=text], input[type=url], input[type=date], input[type=number], input[type=password], input[type=email], textarea, select {
    font: inherit;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--ink);
  }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  textarea { resize: vertical; min-height: 4rem; }
  textarea.markdown { font-family: var(--mono); font-size: 0.9rem; min-height: 16rem; line-height: 1.5; }
  label.field { display: block; margin-bottom: 1.1rem; }
  label.field > span.name, .field > .name { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.3rem; }
  .field .help { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }
  .field .req { color: var(--warn); }
  .muted { color: var(--muted); }
  .mono { font-family: var(--mono); font-size: 0.85em; }
  .row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; }
  .problems { background: #fff3f3; border: 1px solid var(--danger); color: var(--danger); padding: 0.6rem 0.9rem; border-radius: var(--radius); margin-bottom: 1rem; }
  .pill { display: inline-block; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--line); color: var(--muted); }
  .pill.today { background: var(--today); color: #000; }
  .pill.ok { background: #e2f2e5; color: var(--accent-ink); }
`;
