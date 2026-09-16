// The content model, shared by the static build and the CMS (server and UI).
//
// Every collection is a directory of Markdown files with YAML front matter;
// sibling files (images, PDFs, videos) are copied to the collection's URL
// directory unchanged. Field `kind`s drive both validation on the server and
// the editor widgets in the admin UI.

export const IMAGE_SIZE = { width: 560, height: 350 };
export const PORTRAIT_SIZE = { width: 400, height: 400 };

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
      { name: 'url', kind: 'url', label: 'Video URL', help: 'YouTube, Vimeo, or PeerTube page URL. Leave empty to use an uploaded file.' },
      { name: 'file', kind: 'file', accept: 'video/mp4', label: 'Video file', help: 'Self-hosted alternative to a URL.' },
      { name: 'image', kind: 'image', size: IMAGE_SIZE, label: 'Poster', required: true },
      { name: 'imageAlt', kind: 'string', label: 'Poster description', required: true },
      { name: 'event', kind: 'string', help: 'Conference or venue.' },
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
    fields: [
      { name: 'title', kind: 'string', required: true },
      { name: 'date', kind: 'date', required: true },
      { name: 'description', kind: 'text', required: true },
      { name: 'pdf', kind: 'file', accept: 'application/pdf', label: 'PDF', required: true },
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
  for (const f of col.fields) {
    const v = data[f.name];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) problems.push(`${f.label || f.name} is required`);
    if (f.kind === 'date' && !empty && !/^\d{4}-\d{2}-\d{2}$/.test(v)) problems.push(`${f.name} must be YYYY-MM-DD`);
  }
  return problems;
}
