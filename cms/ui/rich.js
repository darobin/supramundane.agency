// <sm-rich>: a WYSIWYG editor (TipTap) that reads and writes Markdown.
// mode="inline" allows only bold/italic/links (for one-paragraph fields that
// also travel as plain text); mode="block" is the full document editor.
// Renders in light DOM so ProseMirror's selection handling stays simple; the
// host's `richText` stylesheet styles it.
import { LitElement, html } from 'lit';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';

export class Rich extends LitElement {
  static properties = {
    value: { type: String },
    mode: { type: String },
    compact: { type: Boolean },
    _linking: { state: true },
    _tick: { state: true },
  };

  constructor() {
    super();
    this.value = '';
    this.mode = 'block';
    this._last = null; // markdown we last emitted, to avoid echo resets
  }

  createRenderRoot() { return this; }

  firstUpdated() {
    const inline = this.mode === 'inline';
    const surface = this.querySelector('.surface');
    this._editor = new Editor({
      element: surface,
      extensions: [
        StarterKit.configure(inline ? {
          heading: false, bulletList: false, orderedList: false, listItem: false, blockquote: false,
          codeBlock: false, code: false, horizontalRule: false, strike: false, underline: false,
          hardBreak: false, dropcursor: false, gapcursor: false,
          link: { openOnClick: false, defaultProtocol: 'https' },
        } : {
          underline: false,
          link: { openOnClick: false, defaultProtocol: 'https' },
        }),
        Markdown,
      ],
      content: this.value || '',
      contentType: 'markdown',
      editorProps: {
        attributes: { class: `prose ${inline ? 'inline' : ''}`, spellcheck: 'true' },
        // Inline fields: a newline would start a paragraph; keep them single.
        handleKeyDown: inline ? (view, e) => e.key === 'Enter' : undefined,
      },
      onUpdate: ({ editor }) => {
        // The serializer entity-escapes ampersands; Markdown doesn't need that.
        let md = editor.getMarkdown().replace(/&amp;/g, '&');
        if (inline) md = md.replace(/\n{2,}/g, ' ').trim();
        this._last = md;
        this.dispatchEvent(new CustomEvent('change', { detail: { value: md }, bubbles: true, composed: true }));
      },
      onSelectionUpdate: () => { this._tick = Date.now(); },
      onTransaction: () => { this._tick = Date.now(); },
    });
  }

  updated(changed) {
    // External value change (a different item loaded): reset the document.
    if (changed.has('value') && this._editor && this.value !== this._last && this.value !== this._editor.getMarkdown()) {
      this._editor.commands.setContent(this.value || '', { contentType: 'markdown', emitUpdate: false });
      this._last = this.value;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._editor?.destroy();
    this._editor = null;
  }

  render() {
    const ed = this._editor;
    const inline = this.mode === 'inline';
    const is = (name, attrs) => (ed?.isActive(name, attrs) ? 'on' : '');
    const run = (fn) => (e) => { e.preventDefault(); fn(ed.chain().focus()).run(); };
    return html`
      <div class="rich ${inline ? 'inline' : 'block'} ${this.compact ? 'compact' : ''}">
        <div class="toolbar" @mousedown=${(e) => e.preventDefault()}>
          <button type="button" class=${is('bold')} title="Bold (⌘B)" @click=${run((c) => c.toggleBold())}><b>B</b></button>
          <button type="button" class=${is('italic')} title="Italic (⌘I)" @click=${run((c) => c.toggleItalic())}><i>I</i></button>
          <button type="button" class=${is('link')} title="Link (⌘K)" @click=${(e) => { e.preventDefault(); this._link(); }}>🔗</button>
          ${inline ? '' : html`
            <span class="gap"></span>
            <button type="button" class=${is('heading', { level: 2 })} title="Heading" @click=${run((c) => c.toggleHeading({ level: 2 }))}>H2</button>
            <button type="button" class=${is('heading', { level: 3 })} title="Subheading" @click=${run((c) => c.toggleHeading({ level: 3 }))}>H3</button>
            <button type="button" class=${is('bulletList')} title="Bullet list" @click=${run((c) => c.toggleBulletList())}>• list</button>
            <button type="button" class=${is('orderedList')} title="Numbered list" @click=${run((c) => c.toggleOrderedList())}>1. list</button>
            <button type="button" class=${is('blockquote')} title="Quote" @click=${run((c) => c.toggleBlockquote())}>❝</button>
            <button type="button" class=${is('code')} title="Code" @click=${run((c) => c.toggleCode())}>&lt;/&gt;</button>
            <button type="button" title="Rule" @click=${run((c) => c.setHorizontalRule())}>―</button>
            <span class="gap"></span>
            <button type="button" title="Undo" @click=${run((c) => c.undo())}>↶</button>
            <button type="button" title="Redo" @click=${run((c) => c.redo())}>↷</button>`}
        </div>
        <div class="surface"></div>
        ${this._linking ? html`<div class="linkbar">
          <input type="url" placeholder="https://… (empty removes the link)" .value=${this._linking.href}
            @input=${(e) => { this._linking = { ...this._linking, href: e.target.value }; }}
            @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._applyLink(); } if (e.key === 'Escape') this._linking = null; }}>
          <button type="button" @click=${() => this._applyLink()}>Apply</button>
          <button type="button" @click=${() => { this._linking = null; }}>Cancel</button>
        </div>` : ''}
      </div>`;
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && this._editor?.isFocused) { e.preventDefault(); this._link(); }
    };
    this.addEventListener('keydown', this._onKey);
  }

  _link() {
    const href = this._editor.getAttributes('link').href || '';
    this._linking = { href };
    this.updateComplete.then(() => this.querySelector('.linkbar input')?.focus());
  }

  _applyLink() {
    const href = (this._linking?.href || '').trim();
    const chain = this._editor.chain().focus().extendMarkRange('link');
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    this._linking = null;
  }
}
customElements.define('sm-rich', Rich);
