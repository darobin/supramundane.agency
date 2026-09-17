// <sm-image-crop>: drop (or paste, or pick) an image, pan and zoom it inside a
// fixed frame, and get back an exactly-sized crop. The frame's aspect ratio is
// the target's; the export is always target width × height.
import { LitElement, html, css } from 'lit';
import { base } from './styles.js';

export class ImageCrop extends LitElement {
  static properties = {
    width: { type: Number },
    height: { type: Number },
    current: { type: String },   // URL of the existing image, if any
    label: { type: String },
    _img: { state: true },
    _scale: { state: true },
    _min: { state: true },
    _over: { state: true },
    _busy: { state: true },
  };

  static styles = [base, css`
    :host { display: block; }
    .frame {
      position: relative;
      width: 100%;
      max-width: 560px;
      border: 2px dashed var(--line);
      background: repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 20px 20px;
      overflow: hidden;
      cursor: pointer;
      user-select: none;
      touch-action: none;
    }
    .frame.over { border-color: var(--accent); background: #efeafd; }
    .frame.has { border-style: solid; cursor: grab; }
    .frame.has:active { cursor: grabbing; }
    canvas, img.current { display: block; width: 100%; height: auto; }
    .placeholder {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: var(--muted); text-align: center; padding: 1rem; font-size: 0.9rem; pointer-events: none;
    }
    .placeholder strong { color: var(--ink); }
    .controls { display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem; max-width: 560px; }
    .controls input[type=range] { flex: 1; }
    input[type=file] { display: none; }
    .size { font-size: 0.75rem; color: var(--muted); }
  `];

  constructor() {
    super();
    this.width = 560;
    this.height = 350;
    this._img = null;
    this._scale = 1;
    this._min = 1;
    this._ox = 0;
    this._oy = 0;
    this._over = false;
    this._busy = false;
    this._onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); this._load(file); }
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('paste', this._onPaste);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('paste', this._onPaste);
  }

  render() {
    const has = !!this._img;
    return html`
      <div class="frame ${this._over ? 'over' : ''} ${has ? 'has' : ''}"
        style="aspect-ratio: ${this.width} / ${this.height}"
        @dragover=${(e) => { e.preventDefault(); this._over = true; }}
        @dragleave=${() => { this._over = false; }}
        @drop=${this._drop}
        @click=${() => { if (!has) this.renderRoot.querySelector('input[type=file]').click(); }}
        @pointerdown=${this._down} @pointermove=${this._move} @pointerup=${this._up} @pointercancel=${this._up}
        @wheel=${this._wheel}>
        ${has
          ? html`<canvas width=${this.width} height=${this.height}></canvas>`
          : this.current
            ? html`<img class="current" src=${this.current} alt="">`
            : ''}
        ${!has ? html`<div class="placeholder">
            <div><strong>Drop an image here</strong>${this.current ? ' to replace the current one' : ''}</div>
            <div>or paste, or click to choose · exported at ${this.width}×${this.height}</div>
          </div>` : ''}
      </div>
      ${has ? html`
        <div class="controls">
          <span class="size">zoom</span>
          <input type="range" min=${this._min} max=${this._min * 5} step="0.001" .value=${String(this._scale)}
            @input=${(e) => this._zoomTo(Number(e.target.value))}>
          <button @click=${this._cancel} ?disabled=${this._busy}>Cancel</button>
          <button class="primary" @click=${this._use} ?disabled=${this._busy}>${this._busy ? 'Uploading…' : 'Use this crop'}</button>
        </div>` : ''}
      <input type="file" accept="image/*" @change=${(e) => { const f = e.target.files[0]; if (f) this._load(f); e.target.value = ''; }}>
    `;
  }

  updated() {
    if (this._img) this._draw();
  }

  _drop(e) {
    e.preventDefault();
    this._over = false;
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) this._load(file);
  }

  async _load(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    this._file = file;
    this._img = img;
    // Cover the frame, centred.
    this._min = Math.max(this.width / img.naturalWidth, this.height / img.naturalHeight);
    this._scale = this._min;
    this._ox = (this.width - img.naturalWidth * this._scale) / 2;
    this._oy = (this.height - img.naturalHeight * this._scale) / 2;
  }

  _clamp() {
    const w = this._img.naturalWidth * this._scale;
    const h = this._img.naturalHeight * this._scale;
    this._ox = Math.min(0, Math.max(this.width - w, this._ox));
    this._oy = Math.min(0, Math.max(this.height - h, this._oy));
  }

  _draw() {
    const canvas = this.renderRoot.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this._img, this._ox, this._oy, this._img.naturalWidth * this._scale, this._img.naturalHeight * this._scale);
  }

  // Frame pixels per canvas pixel (the canvas is CSS-scaled to fit).
  _ratio() {
    const canvas = this.renderRoot.querySelector('canvas');
    return canvas ? this.width / canvas.getBoundingClientRect().width : 1;
  }

  _down(e) {
    if (!this._img) return;
    this._drag = { x: e.clientX, y: e.clientY, ox: this._ox, oy: this._oy };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  _move(e) {
    if (!this._drag) return;
    const r = this._ratio();
    this._ox = this._drag.ox + (e.clientX - this._drag.x) * r;
    this._oy = this._drag.oy + (e.clientY - this._drag.y) * r;
    this._clamp();
    this._draw();
  }
  _up() { this._drag = null; }

  _wheel(e) {
    if (!this._img) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const r = this._ratio();
    const px = (e.clientX - rect.left) * r;
    const py = (e.clientY - rect.top) * r;
    this._zoomTo(this._scale * (e.deltaY < 0 ? 1.05 : 1 / 1.05), px, py);
  }

  // Zoom keeping the frame point (px, py) fixed; defaults to the centre.
  _zoomTo(scale, px = this.width / 2, py = this.height / 2) {
    scale = Math.min(this._min * 5, Math.max(this._min, scale));
    const k = scale / this._scale;
    this._ox = px - (px - this._ox) * k;
    this._oy = py - (py - this._oy) * k;
    this._scale = scale;
    this._clamp();
    this._draw();
  }

  _cancel() {
    this._img = null;
    this._file = null;
  }

  async _use() {
    this._busy = true;
    try {
      const canvas = this.renderRoot.querySelector('canvas');
      this._draw();
      const png = this._file?.type === 'image/png' || this._file?.type === 'image/svg+xml';
      const blob = await new Promise((res) => canvas.toBlob(res, png ? 'image/png' : 'image/jpeg', 0.9));
      const preview = URL.createObjectURL(blob);
      this.dispatchEvent(new CustomEvent('crop', { detail: { blob, preview, filename: `crop.${png ? 'png' : 'jpg'}` }, bubbles: true, composed: true }));
      this._img = null;
      this._file = null;
    } finally {
      this._busy = false;
    }
  }
}

customElements.define('sm-image-crop', ImageCrop);
