// ATProto side of the CMS: one persisted session for the agency account,
// standard.site publication/document records, and Bluesky posts.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { AtpAgent, RichText } from '@atproto/api';
import { ROOT, loadSite, saveSite, exists } from '../lib/content.js';
import { plain } from '../lib/markdown.js';
import { isoDateTime } from '../lib/dates.js';

const STATE_DIR = path.join(ROOT, '.cms');
const SESSION_FILE = path.join(STATE_DIR, 'session.json');
const DEFAULT_SERVICE = 'https://bsky.social';

let agent = null;
let profile = null;
let current = null;   // the session we last saw from the SDK (to detect rotation by another process)
let reason = null;    // why we are logged out, when we know

// Called by the SDK whenever the session changes. Refresh tokens are
// single-use, so if some other process resumed the same saved session it
// rotated the token under us; on 'expired' we check the file before giving
// up, and only delete it when it holds the very token that just failed.
async function persist(evt, session) {
  await mkdir(STATE_DIR, { recursive: true });
  if (session) {
    current = session;
    reason = null;
    await writeFile(SESSION_FILE, JSON.stringify({ service: agent.serviceUrl.href, session }, null, 2));
    return;
  }
  if (evt === 'expired') {
    const saved = await readSaved();
    if (saved?.session?.refreshJwt && saved.session.refreshJwt !== current?.refreshJwt) {
      console.warn('ATProto session was rotated by another process; resuming from the saved file');
      try {
        await agent.resumeSession(saved.session);
        return;
      } catch (err) {
        console.warn('could not resume rotated session:', err.message);
      }
    }
    reason = `Session expired on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} — log in again.`;
  } else if (evt === 'create-failed') {
    reason = 'Login failed.';
  }
  current = null;
  await rm(SESSION_FILE, { force: true });
}

async function readSaved() {
  if (!(await exists(SESSION_FILE))) return null;
  try { return JSON.parse(await readFile(SESSION_FILE, 'utf8')); } catch { return null; }
}

async function refreshProfile() {
  try {
    const res = await agent.getProfile({ actor: agent.session.did });
    profile = { did: res.data.did, handle: res.data.handle, displayName: res.data.displayName, avatar: res.data.avatar };
  } catch {
    profile = { did: agent.session.did, handle: agent.session.handle };
  }
  return profile;
}

// Resume a saved session on startup. Returns the status object.
export async function resume() {
  const saved = await readSaved();
  if (!saved) {
    if (!reason) reason = 'No saved session — log in on the ATProto page.';
    return status();
  }
  try {
    current = saved.session;
    agent = new AtpAgent({ service: saved.service || DEFAULT_SERVICE, persistSession: persist });
    await agent.resumeSession(saved.session);
    await refreshProfile();
  } catch (err) {
    console.warn('could not resume ATProto session:', err.message);
    // A transient failure keeps the session (the SDK left it in place);
    // only a rejected token has cleared it.
    if (!agent?.session) { agent = null; if (!reason) reason = `Could not resume session: ${err.message}`; }
  }
  return status();
}

export async function login({ identifier, password, service = DEFAULT_SERVICE }) {
  identifier = identifier.replace(/^@/, '').trim();
  // Route to the account's own PDS: resolve the handle, then the DID doc.
  const pds = await resolvePds(identifier).catch(() => null);
  agent = new AtpAgent({ service: pds || service, persistSession: persist });
  await agent.login({ identifier, password });
  await refreshProfile();
  // Remember the DID so the site can serve /.well-known/atproto-did.
  const site = await loadSite();
  if (site.atprotoDid !== agent.session.did) {
    site.atprotoDid = agent.session.did;
    await saveSite(site);
  }
  return status();
}

export async function logout() {
  agent = null;
  profile = null;
  current = null;
  reason = 'Logged out.';
  await rm(SESSION_FILE, { force: true });
  return status();
}

export function status() {
  return agent?.session ? { loggedIn: true, ...profile, service: agent.serviceUrl.href } : { loggedIn: false, reason };
}

function need() {
  if (!agent?.session) throw new Error(`Not logged in to ATProto. ${reason || ''}`.trim());
  return agent;
}

async function resolvePds(handle) {
  const r = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!r.ok) throw new Error('handle does not resolve');
  const { did } = await r.json();
  const docUrl = did.startsWith('did:plc:') ? `https://plc.directory/${did}` : `https://${did.slice(8)}/.well-known/did.json`;
  const doc = await (await fetch(docUrl)).json();
  const svc = (doc.service || []).find((s) => s.id === '#atproto_pds');
  return svc?.serviceEndpoint || null;
}

async function uploadImage(file) {
  const bytes = await readFile(file);
  const ext = path.extname(file).toLowerCase();
  const encoding = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  const res = await need().uploadBlob(bytes, { encoding });
  return res.data.blob;
}

// ── standard.site ────────────────────────────────────────────────────────────

// Create (or update) the site.standard.publication record and remember its
// at:// URI in site.json. The build serves it at /.well-known/site.standard.publication.
export async function ensurePublication({ iconFile } = {}) {
  const a = need();
  const site = await loadSite();
  const url = site.url.replace(/\/$/, '');
  const record = {
    $type: 'site.standard.publication',
    url,
    name: site.title,
    description: site.description,
    preferences: { showInDiscover: true },
  };
  if (iconFile && (await exists(iconFile))) record.icon = await uploadImage(iconFile);
  let uri;
  if (site.publicationUri) {
    const { rkey } = parseAtUri(site.publicationUri);
    const res = await a.com.atproto.repo.putRecord({ repo: a.session.did, collection: 'site.standard.publication', rkey, record });
    uri = res.data.uri;
  } else {
    const res = await a.com.atproto.repo.createRecord({ repo: a.session.did, collection: 'site.standard.publication', record });
    uri = res.data.uri;
  }
  site.publicationUri = uri;
  await saveSite(site);
  return { uri, record: { ...record, icon: record.icon ? '(blob)' : undefined } };
}

// Set the account's Bluesky avatar from an image file (the publication icon).
export async function setAvatar(file) {
  const a = need();
  const blob = await uploadImage(file);
  await a.upsertProfile((existing) => ({ ...(existing || {}), avatar: blob }));
  await refreshProfile();
  return status();
}

// Publish an item (news, report) as a site.standard.document; optionally
// announce it on Bluesky and cross-link the two. Returns { atUri, bskyUri }.
//
// The Bluesky affordance ("read on <publication>", the source line, the
// theme) comes from the appview hydrating `external.associatedRefs`: strong
// refs (uri + cid) to the document and its publication, which it validates
// against the link (publication.url + document.path). Order matters and is
// the same as Leaflet's: write the document, pin its cid in the post, then
// point the document back at the post.
export async function publishDocument(item, { post = true, text, repost = false, siteConfig } = {}) {
  const a = need();
  const site = siteConfig || (await loadSite());
  if (!site.publicationUri) throw new Error('Create the standard.site publication first (ATProto panel).');
  const baseUrl = site.url.replace(/\/$/, '');
  const pageUrl = `${baseUrl}${item.url}`;
  const imageFile = item.data.image ? path.join(item.dir, item.data.image) : null;
  const cover = imageFile && (await exists(imageFile)) ? await uploadImage(imageFile) : undefined;

  const record = {
    $type: 'site.standard.document',
    site: site.publicationUri,
    path: item.url.replace(/\/$/, ''),
    title: item.title,
    description: plain(item.data.description),
    publishedAt: isoDateTime(item.data.date),
    updatedAt: new Date().toISOString(),
    tags: item.data.tags || [],
    textContent: plain(item.body),
    contributors: [{ did: a.session.did, displayName: site.title, role: 'publisher' }],
  };
  if (cover) record.coverImage = cover;
  if (item.data.bskyUri && item.data.bskyCid) record.bskyPostRef = { uri: item.data.bskyUri, cid: item.data.bskyCid };

  const docRef = await writeDocument(a, item.data.atUri, record);
  const atUri = docRef.uri;
  const pubRef = await strongRef(a, site.publicationUri);

  let bskyUri = item.data.bskyUri;
  let bskyCid = item.data.bskyCid;
  if (bskyUri && repost) {
    // The Bluesky appview never re-indexes an edited post, so a post made
    // without associatedRefs can only gain the standard.site card by being
    // made again. Reuse its text unless new text was given.
    const { rkey } = parseAtUri(bskyUri);
    const old = await a.com.atproto.repo.getRecord({ repo: a.session.did, collection: 'app.bsky.feed.post', rkey }).catch(() => null);
    if (!text && old?.data?.value?.text) text = old.data.value.text;
    await a.deletePost(bskyUri);
    bskyUri = undefined;
    bskyCid = undefined;
  }
  if (post && !bskyUri) {
    const rt = new RichText({ text: text || defaultPostText(item, pageUrl) });
    await rt.detectFacets(a);
    const res = await a.post({
      text: rt.text,
      facets: rt.facets,
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: pageUrl, title: item.title, description: plain(item.data.description),
          ...(cover ? { thumb: cover } : {}),
          associatedRefs: [docRef, pubRef],
        },
      },
      createdAt: new Date().toISOString(),
    });
    bskyUri = res.uri;
    bskyCid = res.cid;
  } else if (bskyUri) {
    // An existing post: make sure it pins the current document/publication.
    // (Other appviews may honour the edit; Bluesky's does not — see `repost`.)
    const repaired = await repairPost(a, bskyUri, docRef, pubRef);
    if (repaired) bskyCid = repaired.cid;
  }

  if (bskyUri && (bskyUri !== item.data.bskyUri || bskyCid !== item.data.bskyCid || !item.data.atUri)) {
    // Cross-link so standard.site readers find the conversation.
    await writeDocument(a, atUri, { ...record, bskyPostRef: { uri: bskyUri, cid: bskyCid } });
  }
  return { atUri, bskyUri, bskyCid, pageUrl };
}

// Create or replace the document record; returns its strong ref.
async function writeDocument(a, atUri, record) {
  if (atUri) {
    const { rkey } = parseAtUri(atUri);
    const res = await a.com.atproto.repo.putRecord({ repo: a.session.did, collection: 'site.standard.document', rkey, record });
    return { uri: res.data.uri, cid: res.data.cid };
  }
  const res = await a.com.atproto.repo.createRecord({ repo: a.session.did, collection: 'site.standard.document', record });
  return { uri: res.data.uri, cid: res.data.cid };
}

async function strongRef(a, uri) {
  const { did, collection, rkey } = parseAtUri(uri);
  const res = await a.com.atproto.repo.getRecord({ repo: did, collection, rkey });
  return { uri: res.data.uri, cid: res.data.cid };
}

// Add associatedRefs to a post that was made without them (or whose refs are
// stale). Returns the new strong ref of the post, or null if nothing changed.
async function repairPost(a, postUri, docRef, pubRef) {
  const { rkey } = parseAtUri(postUri);
  const res = await a.com.atproto.repo.getRecord({ repo: a.session.did, collection: 'app.bsky.feed.post', rkey });
  const post = res.data.value;
  const external = post?.embed?.external;
  if (!external) return null;
  const want = [docRef, pubRef];
  const have = external.associatedRefs || [];
  const same = have.length === want.length && want.every((w) => have.some((h) => h.uri === w.uri && h.cid === w.cid));
  if (same) return null;
  const updated = { ...post, embed: { ...post.embed, external: { ...external, associatedRefs: want } } };
  const put = await a.com.atproto.repo.putRecord({ repo: a.session.did, collection: 'app.bsky.feed.post', rkey, record: updated });
  return { uri: put.data.uri, cid: put.data.cid };
}

export function defaultPostText(item, pageUrl) {
  const max = 300;
  let text = `${item.title}\n\n${plain(item.data.description)}`;
  const tail = `\n\n${pageUrl}`;
  if ([...text].length + [...tail].length > max) text = [...text].slice(0, max - [...tail].length - 1).join('') + '…';
  return text + tail;
}

export function bskyWebUrl(atUri, handle) {
  const { did, rkey } = parseAtUri(atUri);
  return `https://bsky.app/profile/${handle || did}/post/${rkey}`;
}

function parseAtUri(uri) {
  const m = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!m) throw new Error(`bad at:// URI: ${uri}`);
  return { did: m[1], collection: m[2], rkey: m[3] };
}
