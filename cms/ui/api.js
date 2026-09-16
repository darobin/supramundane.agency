// Thin fetch wrappers for the CMS API.
async function req(method, url, body, headers = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (body instanceof Blob || body instanceof ArrayBuffer) {
      init.body = body;
      init.headers['Content-Type'] = body.type || 'application/octet-stream';
    } else {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  return data;
}

const enc = encodeURIComponent;

export const api = {
  state: () => req('GET', '/api/state'),
  item: (type, id) => req('GET', `/api/items/${type}/${enc(id)}`),
  save: (type, id, payload) => req('PUT', `/api/items/${type}/${enc(id)}`, payload),
  remove: (type, id) => req('DELETE', `/api/items/${type}/${enc(id)}`),
  upload: (blob, filename) => req('POST', '/api/uploads', blob, filename ? { 'X-Filename': filename } : {}),
  saveSite: (site) => req('PUT', '/api/site', site),
  settings: (s) => req('PUT', '/api/settings', s),
  build: () => req('POST', '/api/build'),
  publish: () => req('POST', '/api/publish'),
  atproto: {
    login: (creds) => req('POST', '/api/atproto/login', creds),
    logout: () => req('POST', '/api/atproto/logout'),
    publication: () => req('POST', '/api/atproto/publication'),
    preview: (type, id) => req('GET', `/api/atproto/preview/${type}/${enc(id)}`),
    publish: (type, id, opts) => req('POST', `/api/atproto/publish/${type}/${enc(id)}`, opts),
  },
  events(onEvent) {
    const es = new EventSource('/api/events');
    for (const name of ['hello', 'built', 'published', 'publish-log', 'error', 'items-changed']) {
      es.addEventListener(name, (e) => onEvent(name, JSON.parse(e.data || '{}')));
    }
    return es;
  },
};
