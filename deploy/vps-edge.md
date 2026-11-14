# Adding `seo.lv24.by` to the containerized LV24 edge

The production edge is the `lv24-city-edge-nginx` container in the `lv24-city`
Compose project, not the host nginx service. This page is the authoritative
runbook for production. [`README.md`](./README.md) covers the shared deploy and
rollback commands plus the bare-metal fallback.

## What the edge mounts today

The active edge is built from the release tree under
`/opt/lv24-releases/<release>/lv24/main/infra`. Its `nginx` service uses
`docker-compose.softlaunch.yml`, which **overrides** the volume list and mounts
each vhost explicitly. The relevant entries are:

| Host path | Container path | Mode |
|---|---|---|
| `/opt/lv24-releases/<release>/lv24/main/infra/nginx/nginx.tls.conf` | `/etc/nginx/conf.d/default.conf` | read-only |
| `/opt/lv24-releases/<release>/lv24/main/infra/nginx/brain.lv24.by.conf` | `/etc/nginx/conf.d/brain.lv24.by.conf` | read-only |
| `/opt/lv24-sites/lv24-brain-site` | `/srv/brain-site` | read-only |
| `/opt/lv24-src/lv24/main/infra/nginx/letsencrypt` | `/etc/nginx/certs` | read-only |
| `/opt/lv24-src/lv24/main/infra/nginx/certbot-www` | `/var/www/certbot` | read-only |

The config directory is **not** glob-mounted. A new `seo.lv24.by.conf` is
invisible to the container until it is added as an explicit bind mount and the
container is recreated. Do not assume that copying the file into `nginx/` is
enough.

Resolve the active release and compose files instead of hard-coding a release
stamp:

```sh
sudo docker inspect lv24-city-edge-nginx \
  --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```

The label is comma-separated. The first path is in the compose project
directory; `docker-compose.softlaunch.yml` in that directory owns the edge
volume list. The service name is `nginx` in the `lv24-city` project.

## One-time setup

### 1. Create the site directory

```sh
sudo install -d -m 755 /opt/lv24-sites/lv24-seo-site
```

`scripts/deploy-prod.sh` creates `root`, `root.new` and `root.prev-<ts>` below
this directory. The parent must exist and be writable through `sudo`.

### 2. Install the vhost in both nginx trees

Copy the sample as `seo.lv24.by.conf` into the active release tree (the live
mount source) and into the source tree (so the next release keeps it):

```sh
release_infra=/opt/lv24-releases/<release>/lv24/main/infra
src_infra=/opt/lv24-src/lv24/main/infra
sudo install -m 644 deploy/nginx.seo.lv24.by.conf.example \
  "$release_infra/nginx/seo.lv24.by.conf"
sudo install -m 644 deploy/nginx.seo.lv24.by.conf.example \
  "$src_infra/nginx/seo.lv24.by.conf"
```

The sample already uses the container root `/srv/seo-site/root` and the
certificate paths `/etc/nginx/certs/live/seo.lv24.by/{fullchain,privkey}.pem`.
Verify both copies and update the two CSP hashes if the build prints different
values (see step 6). The sample contains the VitePress 1.6.4 hashes from
`deploy/csp-hashes.txt`.

### 3. Add the vhost and site binds to the edge

Edit `services.nginx.volumes` in
`/opt/lv24-releases/<release>/lv24/main/infra/docker-compose.softlaunch.yml`
and add:

```yaml
      - type: bind
        source: ./nginx/seo.lv24.by.conf
        target: /etc/nginx/conf.d/seo.lv24.by.conf
        read_only: true
      - type: bind
        source: /opt/lv24-sites/lv24-seo-site
        target: /srv/seo-site
        read_only: true
```

`source: ./nginx/...` is relative to the compose project directory, so the
vhost must be in the release tree as well. Mirror the same edit to
`/opt/lv24-src/lv24/main/infra/docker-compose.softlaunch.yml` so a future
release does not lose it.

Mount the **parent** site directory, not `root` itself. `deploy-prod.sh`
renames `root` on every deploy; a bind mount of `root` would keep the old inode
and serve the previous build.

`docker-compose.softlaunch.yml` uses `volumes: !override`. Adding the mount to
`docker-compose.prod.yml` alone is discarded. Keep it in the softlaunch file.

### 4. Recreate only the edge

Use the repository helper; it includes the mandatory prod and softlaunch
overlays and recreates only `nginx`:

```sh
sudo bash /opt/lv24-src/lv24/main/infra/scripts/recreate-edge-nginx.prod.sh
```

The helper defaults to the release stamp recorded in
`prod-city-compose.inc.sh`. If `docker inspect` shows a different active
release, pass it explicitly:

```sh
sudo PROD_CITY_INFRA=/opt/lv24-releases/<release>/lv24/main/infra \
  bash /opt/lv24-src/lv24/main/infra/scripts/recreate-edge-nginx.prod.sh
```

The helper verifies that host `:80`/`:443` are published, that the IdP and CSP
include files are mounted, and smoke-tests `https://lv24.by/`.

Never run a core-only recreate such as
`docker compose -f docker-compose.yml -f docker-compose.core.yml up -d --force-recreate nginx`.
That publishes `4100:80` instead of `80:80`/`443:443` and takes the public site
down; the 2026-08-04 incident had exactly that cause. For a bind-mounted
config-only change, `docker restart lv24-city-edge-nginx` is enough and keeps
the port mappings.

Verify the new mounts:

```sh
sudo docker inspect lv24-city-edge-nginx \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

Both of these lines must appear:

```text
/opt/lv24-sites/lv24-seo-site -> /srv/seo-site
/opt/lv24-releases/<release>/lv24/main/infra/nginx/seo.lv24.by.conf -> /etc/nginx/conf.d/seo.lv24.by.conf
```

### 5. Issue the certificate

The edge already mounts the certbot tree. Use the `certbot` Compose profile in
the same project, not a host `certbot` that writes to `/etc/letsencrypt`; the
container only sees the mounted tree.

Run a dry run first. Let's Encrypt rate-limits failed validations, so do not
repeat a failing request:

```sh
sudo bash -c '
  cd /opt/lv24-src/lv24/main/infra
  export PROD_CITY_INFRA=/opt/lv24-releases/<release>/lv24/main/infra
  export SSL_CERT_DIR=/opt/lv24-src/lv24/main/infra/nginx/letsencrypt
  export ACME_WEBROOT=/opt/lv24-src/lv24/main/infra/nginx/certbot-www
  source scripts/prod-city-compose.inc.sh
  prod_city_compose --profile certbot run --rm certbot \
    certonly --webroot -w /var/www/certbot --dry-run -d seo.lv24.by
'
```

Then issue the real certificate with the ops mailbox:

```sh
sudo bash -c '
  cd /opt/lv24-src/lv24/main/infra
  export PROD_CITY_INFRA=/opt/lv24-releases/<release>/lv24/main/infra
  export SSL_CERT_DIR=/opt/lv24-src/lv24/main/infra/nginx/letsencrypt
  export ACME_WEBROOT=/opt/lv24-src/lv24/main/infra/nginx/certbot-www
  source scripts/prod-city-compose.inc.sh
  prod_city_compose --profile certbot run --rm certbot \
    certonly --webroot -w /var/www/certbot \
    -d seo.lv24.by --email <ops-email> --agree-tos --no-eff-email
'
```

The `SSL_CERT_DIR` and `ACME_WEBROOT` overrides must match the paths mounted
by `docker-compose.softlaunch.yml`. Without them, Compose defaults to
`./nginx/letsencrypt` and `./nginx/certbot-www` relative to the release tree,
and the edge will not see the new certificate.

The live files must exist under the mounted tree:

```sh
sudo ls -l /opt/lv24-src/lv24/main/infra/nginx/letsencrypt/live/seo.lv24.by/
```

If `SSL_CERT_DIR` points at another host directory, use that path instead; the
container path is always `/etc/nginx/certs/live/seo.lv24.by/`.

Renewal is not automatic just because the certificate exists. Schedule the
same profile daily (or use the existing edge certbot timer) and reload the edge
after a successful renewal:

```sh
sudo bash -c '
  cd /opt/lv24-src/lv24/main/infra
  export PROD_CITY_INFRA=/opt/lv24-releases/<release>/lv24/main/infra
  export SSL_CERT_DIR=/opt/lv24-src/lv24/main/infra/nginx/letsencrypt
  export ACME_WEBROOT=/opt/lv24-src/lv24/main/infra/nginx/certbot-www
  source scripts/prod-city-compose.inc.sh
  prod_city_compose --profile certbot run --rm certbot \
    renew --webroot -w /var/www/certbot
'
sudo docker exec lv24-city-edge-nginx nginx -t
sudo docker exec lv24-city-edge-nginx nginx -s reload
```

Do not run `certbot renew` against `/etc/letsencrypt` on the host unless that
directory is the one mounted into the edge. A renewal that writes elsewhere is
invisible to nginx and the certificate expires silently.

### 6. First deploy and CSP hashes

```sh
bash scripts/deploy-prod.sh
```

The script builds with `DOCS_SITE_URL=https://seo.lv24.by`, runs lint and tests,
checks the inline-script hashes against `deploy/csp-hashes.txt`, uploads the
build, swaps the vhost root atomically and requests `/`, `/ru/`, `/zh/` and
`/reference/cli/`.

If the hash check fails, update `deploy/csp-hashes.txt` and the `script-src`
directive in the installed vhost, validate and reload the edge, then re-run the
deploy:

```sh
sudo docker exec lv24-city-edge-nginx nginx -t
sudo docker exec lv24-city-edge-nginx nginx -s reload
bash scripts/deploy-prod.sh
```

## Normal deploy

```sh
bash scripts/deploy-prod.sh
```

The parent directory bind means the container sees the renamed `root`
immediately; no nginx reload is required for a content-only deploy.

## Verification

```sh
for path in / /ru/ /zh/ /reference/cli/; do
  curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" "https://seo.lv24.by$path"
done

curl -fsSI https://seo.lv24.by/ \
  | grep -iE 'content-security-policy|strict-transport-security|x-content-type-options|referrer-policy'
curl -fsSI https://seo.lv24.by/version.json | grep -i '^cache-control:'
curl -fsS https://seo.lv24.by/robots.txt
curl -fsS https://seo.lv24.by/sitemap.xml | head
curl -sS -o /dev/null -w '%{http_code}\n' https://seo.lv24.by/does-not-exist
```

Expected: four `200`s, a CSP containing both hashes, HSTS, `Cache-Control:
no-store` for `version.json`, the sitemap URL in `robots.txt`, and `404` for the
missing page. Check one hashed asset for the one-year cache:

```sh
asset=$(curl -fsS https://seo.lv24.by/ | grep -o '/assets/[^"]*\.js' | head -n1)
curl -fsSI "https://seo.lv24.by$asset" | grep -i '^cache-control:'
```

Open the site with the browser devtools console: no CSP violations and no
requests to third-party origins.

## Rollback

List retained builds:

```sh
ssh lv24 'sudo ls -1 /opt/lv24-sites/lv24-seo-site'
```

Restore the previous directory atomically, keeping the failed build:

```sh
ssh lv24 'sudo bash -s' <<'EOF'
set -euo pipefail
cd /opt/lv24-sites/lv24-seo-site
ts=$(date -u +%Y%m%dT%H%M%SZ)
mv root "root.failed-$ts"
mv root.prev-20261114T120000Z root
EOF
```

Replace `root.prev-20261114T120000Z` with the directory you want. No nginx
reload is needed for a directory swap. Re-run the verification URLs.

If the vhost itself is broken, restore the previous `seo.lv24.by.conf` in the
release and source trees, then validate and reload:

```sh
sudo docker exec lv24-city-edge-nginx nginx -t
sudo docker exec lv24-city-edge-nginx nginx -s reload
```

Prune old directories only after the rollback is confirmed:

```sh
ssh lv24 'sudo find /opt/lv24-sites/lv24-seo-site -maxdepth 1 -type d -name "root.prev-*" -mtime +14 -print'
```

Review the list before deleting anything; keep at least the last known-good
build.

## After every edge release

The active release tree is replaced when the edge is upgraded. Before the next
deploy:

1. Confirm `nginx/seo.lv24.by.conf` exists in the new release tree.
2. Confirm the vhost and site binds are still in that tree's
   `docker-compose.softlaunch.yml`; mirror them to the source tree.
3. Run `recreate-edge-nginx.prod.sh` only if the container was recreated.
4. Re-check `docker inspect` mounts and the verification URLs.

A release that drops the vhost or the site bind makes the domain return 404 or
connection errors even though the files are still on disk.

## Zero-spend notes

- DNS, certbot, nginx and the existing VPS are already paid for; this adds no
  new service.
- The site is static: no database, no Node runtime, no external fonts, CDNs or
  analytics.
- The edge container serves only files from the mounted directory.
