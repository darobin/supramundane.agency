// The content model, shared by the static build and the CMS (server and UI).
//
// Every collection is a directory of Markdown files with YAML front matter;
// sibling files (images, PDFs, videos) are copied to the collection's URL
// directory unchanged. Field `kind`s drive both validation on the server and
// the editor widgets in the admin UI.

export const IMAGE_SIZE = { width: 560, height: 350 };
export const PORTRAIT_SIZE = { width: 800, height: 800 };

export const collections = {
  news: {
    label: 'News',
    singular: 'news item',
    dir: 'content/news',
    // Items live in content/news/<yyyy>/<mmdd>-<slug>.md and keep the historical
    // URL layout: /<yyyy>/<mmdd>-<slug>/.
    urlPrefix: '/',
    dated: true,
    idFor: (data, slug) => `${data.date.slice(0, 4)}/${data.date.slice(5, 7)}${data.date.slice(8, 10)}-${slug}`,
    fields: [
      { name: 'title', kind: 'string', required: true },
      { name: 'date', kind: 'date', required: true, help: 'When it happens (or happened). Drives Upcoming / Today / Previously.' },
      { name: 'description', kind: 'text', required: true, help: 'One or two sentences. Used in listings, feeds, and social cards.' },
      { name: 'location', kind: 'string', help: 'City, CC — or "online".' },
      { name: 'url', kind: 'url', label: 'Link', help: 'The event, article, or programme this is about. Shown on the page.' },
      { name: 'image', kind: 'image', size: IMAGE_SIZE, required: true },
      { name: 'imageAlt', kind: 'string', label: 'Image description', required: true },
      { name: 'tags', kind: 'tags' },
      { name: 'people', kind: 'refs', ref: 'people', help: 'People from this agency involved.' },
      { name: 'video', kind: 'refs', ref: 'videos', single: true, help: 'A recording, if there is one.' },
      { name: 'report', kind: 'refs', ref: 'reports', single: true, help: 'A report this announces, if any.' },
      { name: 'body', kind: 'markdown' },
      // Set by the publisher, not by hand.
      { name: 'atUri', kind: 'readonly', label: 'standard.site document' },
      { name: 'bskyUri', kind: 'readonly', label: 'Bluesky post' },
    ],
  },
  videos: {
    label: 'Videos',
    singular: 'video',
    dir: 'content/videos',
    urlPrefix: '/videos/',
    dated: true,
    fields: [
      { name: 'title', kind: 'string', required: true },
      { name: 'date', kind: 'date', required: true },
      { name: 'description', kind: 'text', required: true },
      { name: 'event', kind: 'string', help: 'Conference or venue.' },
      { name: 'image', kind: 'image', size: IMAGE_SIZE, label: 'Poster', required: true },
      { name: 'imageAlt', kind: 'string', label: 'Poster description', required: true },
      {
        name: 'clips', kind: 'list', label: 'Videos', itemLabel: 'video', required: true,
        help: 'One entry per recording. A talk is one; a panel with several excerpts is several.',
        fields: [
          { name: 'title', kind: 'string', help: 'Leave empty when there is only one video.' },
          { name: 'url', kind: 'url', label: 'Video URL', help: 'YouTube, Vimeo, or PeerTube page URL — or upload a file below.' },
          { name: 'file', kind: 'file', accept: 'video/mp4', label: 'Video file' },
          { name: 'description', kind: 'text' },
        ],
      },
      { name: 'people', kind: 'refs', ref: 'people' },
      { name: 'tags', kind: 'tags' },
      { name: 'body', kind: 'markdown' },
    ],
  },
  reports: {
    label: 'Reports',
    singular: 'report',
    dir: 'content/reports',
    urlPrefix: '/reports/',
    dated: true,
    requireOneOf: [['pdf', 'link']],
    fields: [
      { name: 'title', kind: 'string', required: true },
      { name: 'date', kind: 'date', required: true },
      { name: 'description', kind: 'text', required: true },
      { name: 'pdf', kind: 'file', accept: 'application/pdf', label: 'PDF' },
      { name: 'link', kind: 'url', label: 'Read online', help: 'Where the report lives if it is published elsewhere; can replace the PDF.' },
      { name: 'image', kind: 'image', size: IMAGE_SIZE, label: 'Cover', required: true },
      { name: 'imageAlt', kind: 'string', label: 'Cover description', required: true },
      { name: 'publisher', kind: 'string', help: 'Who published it, if not us.' },
      { name: 'people', kind: 'refs', ref: 'people', label: 'Authors' },
      { name: 'tags', kind: 'tags' },
      { name: 'body', kind: 'markdown' },
      { name: 'atUri', kind: 'readonly', label: 'standard.site document' },
      { name: 'bskyUri', kind: 'readonly', label: 'Bluesky post' },
    ],
  },
  people: {
    label: 'People',
    singular: 'person',
    dir: 'content/people',
    urlPrefix: '/people/',
    fields: [
      { name: 'name', kind: 'string', required: true },
      { name: 'role', kind: 'string' },
      { name: 'photo', kind: 'image', size: PORTRAIT_SIZE, required: true },
      { name: 'website', kind: 'url' },
      { name: 'bluesky', kind: 'string', help: 'Handle, without the @.' },
      { name: 'email', kind: 'string' },
      { name: 'order', kind: 'number', help: 'Lower comes first in the listing.' },
      { name: 'body', kind: 'markdown', label: 'Bio' },
    ],
  },
  pages: {
    label: 'Pages',
    singular: 'page',
    dir: 'content/pages',
    urlPrefix: '/',
    fields: [
      { name: 'title', kind: 'string', required: true },
      { name: 'description', kind: 'text' },
      { name: 'nav', kind: 'boolean', label: 'Show in navigation' },
      { name: 'body', kind: 'markdown' },
    ],
  },
};

// The one item named `home` in `pages` is the front page's intro.
export const HOME_PAGE = 'home';

// Which field is the item's display title in listings.
export function titleOf(type, data) {
  return type === 'people' ? data.name : data.title;
}

export const siteFields = [
  { name: 'title', kind: 'string', required: true },
  { name: 'description', kind: 'text', required: true },
  { name: 'url', kind: 'url', required: true, help: 'Canonical base URL, with trailing slash.' },
  { name: 'language', kind: 'string' },
  { name: 'authorName', kind: 'string' },
  { name: 'authorEmail', kind: 'string' },
  { name: 'authorUrl', kind: 'url' },
  { name: 'footer', kind: 'text' },
  { name: 'introNews', kind: 'markdown', label: 'News intro', help: 'Shown at the top of /news/.' },
  { name: 'introVideos', kind: 'markdown', label: 'Videos intro', help: 'Shown at the top of /videos/.' },
  { name: 'introReports', kind: 'markdown', label: 'Reports intro', help: 'Shown at the top of /reports/.' },
  { name: 'introPeople', kind: 'markdown', label: 'People intro', help: 'Shown at the top of /people/.' },
  { name: 'atprotoDid', kind: 'readonly', label: 'ATProto DID', help: 'Set on login. Served at /.well-known/atproto-did so the domain works as a handle.' },
  { name: 'publicationUri', kind: 'readonly', label: 'standard.site publication', help: 'Created from the ATProto panel. Served at /.well-known/site.standard.publication.' },
];

export function slugify(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Light validation shared by server and UI. Returns a list of problems.
export function validate(type, data) {
  const col = collections[type];
  const problems = [];
  const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  for (const f of col.fields) {
    const v = data[f.name];
    if (f.required && isEmpty(v)) problems.push(`${f.label || f.name} is required`);
    if (f.kind === 'date' && !isEmpty(v) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) problems.push(`${f.name} must be YYYY-MM-DD`);
    if (f.kind === 'list' && Array.isArray(v)) {
      v.forEach((item, i) => {
        for (const sf of f.fields) if (sf.required && isEmpty(item?.[sf.name])) problems.push(`${f.itemLabel || 'item'} ${i + 1}: ${sf.label || sf.name} is required`);
        if (f.name === 'clips' && isEmpty(item?.url) && isEmpty(item?.file)) problems.push(`video ${i + 1} needs a URL or a file`);
      });
    }
  }
  for (const group of col.requireOneOf || []) {
    if (group.every((n) => isEmpty(data[n]))) {
      const labels = group.map((n) => col.fields.find((f) => f.name === n)?.label || n);
      problems.push(`one of ${labels.join(' / ')} is required`);
    }
  }
  return problems;
}

// Visit every image/file value in an item's data, including inside lists.
// fn(value, set, field, indexOrNull). Used to move uploads into place, carry
// assets along on rename, and clean up on delete.
export function forEachAsset(type, data, fn) {
  for (const f of collections[type].fields) {
    if (['image', 'file'].includes(f.kind)) {
      if (data[f.name]) fn(data[f.name], (v) => { data[f.name] = v; }, f, null);
    } else if (f.kind === 'list' && Array.isArray(data[f.name])) {
      data[f.name].forEach((item, i) => {
        for (const sf of f.fields) {
          if (['image', 'file'].includes(sf.kind) && item?.[sf.name]) fn(item[sf.name], (v) => { item[sf.name] = v; }, sf, i);
        }
      });
    }
  }
}
