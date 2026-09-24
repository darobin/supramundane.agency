# Caddy file_server for supramundane.agency. Unlike sm's default static
# template this does NOT bake the site into the image: content is rsynced into
# the service's data volume (/data) by `npm run publish:site`, so publishing a
# news item never needs a rebuild or restart. `sm deploy` is only needed when
# this Dockerfile or the Caddyfile change.
FROM caddy:2.11.2-alpine
# The image keeps Caddy's own state under /data, which here is the web root
# and gets rsynced with --delete; keep it out of the way instead.
ENV XDG_DATA_HOME=/var/lib/caddy
COPY Caddyfile /etc/caddy/Caddyfile
