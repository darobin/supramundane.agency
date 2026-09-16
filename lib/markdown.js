import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

export function render(src = '') {
  return md.render(src);
}

// Plain text (for feeds, textContent in ATProto records, social posts).
export function plain(src = '') {
  return render(src)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Strip a single wrapping <p> so short markdown can sit inline.
export function inline(src = '') {
  return render(src).trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1');
}
