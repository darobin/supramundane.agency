# supramundane.agency

The website of Supramundane Agency: a static site, generated from Markdown
files by a small Node build, edited through a local web CMS, and pushed to the
`sm` hosting setup with an rsync. No database, no framework; git is the history.

```
content/          the content — the only thing you edit
  site.json         site-wide settings (title, URL, ATProto DID, publication URI…)
  news/<yyyy>/<mmdd>-<slug>.md   + image alongside → /<yyyy>/<mmdd>-<slug>/
  videos/<slug>.md  + poster (+ .mp4 if self-hosted)  → /videos/<slug>/
  reports/<slug>.md + cover + .pdf                    → /reports/<slug>/
  people/<slug>.md  + photo                           → /people/<slug>/
  pages/<slug>.md   (home.md is the front-page intro) → /<slug>/
public/           static assets copied as-is (css, fonts, js, img)
lib/              shared model: schema.js (content types), content.js (load/save), dates.js, markdown.js
build/            the generator: index.js + templates.js → site/
cms/              the local CMS: server.js (API + preview), ui/ (Lit + refrakt admin), atproto.js, deploy.js
deploy/           the `sm` service (Dockerfile, Caddyfile, service.json, compose.yaml)
site/             build output (git-ignored)
.cms/             CMS state: ATProto session, pending uploads, settings (git-ignored)
```

## Day to day

```sh
npm install
npm run dev          # bundles the admin UI, starts the CMS at http://localhost:4321/
                     # and a preview of the built site at http://localhost:4322/
```

Everything you save in the CMS is written to `content/` and the preview is
rebuilt within a second (so is anything you edit by hand in `content/` or
`public/`). **Publish site** in the sidebar pushes `site/` to the server; tick
**auto-publish on save** to have every save go live on its own. Publishing is
an rsync into the service's data volume, which its Caddy serves directly, so it
takes about a second and needs no rebuild or restart.

Command-line equivalents: `npm run build` (just build), `npm run publish:site`
(build + push).

### News

A news item wants a title, a date, a description, and an image. Drop an image
(or paste one, or click to pick) on the frame, pan and zoom, and **Use this
crop**: it is exported at exactly 560×350 whatever you gave it. The slug is
derived from the title (editable); the URL is `/<yyyy>/<mmdd>-<slug>/`, as it
has always been.

The site sorts news into **Today** (highlighted), **Upcoming**, and
**Previously** at build time and, because a static build has no idea what day
it is when it is read, again in the browser (`public/js/news-today.js`) so items
move on their own without a rebuild.

### Videos

Paste a YouTube, Vimeo, or PeerTube page URL and the site embeds the player
(privacy-friendly variants: `youtube-nocookie`, Vimeo `dnt=1`). Or drop an
`.mp4` for self-hosting. Each video needs a poster image (same cropper). A news
item can point at its recording.

### Reports

Drop the PDF and a cover image; the page gets a download button with the file
size. Authors are picked from People. A news item can point at a report.

### People

Name, role, square photo (400×400, same cropper), links, bio. A person's page
lists their news, videos, and reports.

## ATProto: standard.site and Bluesky

On the **ATProto** page, log in with the agency account and an app password
(once; the session is kept in `.cms/`). Logging in records the account's DID in
`site.json`, and the build then serves it at `/.well-known/atproto-did` so
`supramundane.agency` can be set as the account's handle (Bluesky settings →
Change handle → I have my own domain → No DNS panel).

**Create publication record** creates the `site.standard.publication` record
(with `public/img/publication-icon.png` as icon) and stores its `at://` URI in
`site.json`; the build serves it at `/.well-known/site.standard.publication`.

Then, on any saved news item or report, **Publish to standard.site & Bluesky…**:

1. pushes the site live (the post links to the page);
2. creates a `site.standard.document` record (title, description, path, tags,
   cover image, plain-text content, `publishedAt`);
3. posts to Bluesky with an editable text and a link card, and cross-links the
   post from the document (`bskyPostRef`);
4. writes the two URIs into the item's front matter and pushes again, so the
   page carries `<link rel="site.standard.document" href="at://…">`.

## Hosting (`sm`)

`deploy/` is an `sm` static service named `supramundane-agency` whose Caddy
serves `/data` — the service's data volume — rather than files baked into the
image. Set up once (and again only if `deploy/` changes):

```sh
export SUPRAMUNDANE=<server> SM_REMOTE_USER=root   # as for sm itself
npm run sm:deploy          # = cd deploy && sm deploy
npm run publish:site       # first push of the content
```

`cms/deploy.js` reads the same environment (`SUPRAMUNDANE`, `SM_REMOTE_USER`,
`SM_DATA_ROOT`) and rsyncs `site/` to `$SM_DATA_ROOT/supramundane-agency/`.

## Adding a content type or field

Edit `lib/schema.js`: a collection is a directory, a URL prefix, and a list of
fields with a `kind` (`string`, `text`, `markdown`, `date`, `url`, `number`,
`boolean`, `tags`, `refs`, `image` (with a `size`), `file`, `readonly`). The
CMS form, validation, file layout, and asset handling follow from it; only the
templates in `build/templates.js` need to know what to do with a new field.
