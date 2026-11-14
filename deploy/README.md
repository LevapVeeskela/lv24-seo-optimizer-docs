# Deploying `seo.lv24.by`

Static VitePress site behind the LV24 edge nginx. The build is a directory of
files; there is no application server, database, or runtime process. Deploys
run from a checkout, upload a tarball over SSH and swap the vhost root
atomically.

Production uses the containerized `lv24-city-edge-nginx`; the exact one-time
wiring is in [`vps-edge.md`](./vps-edge.md). This page covers the shared deploy
and rollback commands plus the bare-metal fallback.

Files in this directory:

- `nginx.seo.lv24.by.conf.example` — HTTP redirect, TLS, static-file vhost,
  cache headers, security headers and the hash-pinned CSP.
- `csp-hashes.txt` — the two stable inline-script hashes allowed by the CSP,
  generated from the VitePress 1.6.4 build. `csp-hashes.txt.example` documents
  the format.
- `README.md` — this runbook.
- `vps-edge.md` — exact wiring for the containerized `lv24-city-edge-nginx`
  on the LV24 VPS (explicit vhost bind, site bind, recreate helper and certbot
  profile).

## Prerequisites

- DNS for `seo.lv24.by` pointing at the VPS (A and/or AAAA).
- An SSH host alias `lv24` with `sudo` on the target:

  ```sh
  # ~/.ssh/config
  Host lv24
      HostName <vps-address>
      User <deploy-user>
  ```

- Node.js >= 20 and a committed `package-lock.json` in the checkout, because
  `scripts/deploy-prod.sh` runs `npm ci`.
- The repository's gates pass locally (`npm run lint`, `npm test`,
  `npm run docs:build`).
- Production only: access to the `lv24-city` Compose project and its active
  release tree. The host nginx service is not used.

## Production (containerized edge)

Complete the one-time setup in [`vps-edge.md`](./vps-edge.md):

1. Create `/opt/lv24-sites/lv24-seo-site`.
2. Install `seo.lv24.by.conf` in the release and source nginx trees, with the
   container root `/srv/seo-site/root` and certificate paths
   `/etc/nginx/certs/live/seo.lv24.by/...`.
3. Add the explicit vhost bind and the site bind to
   `docker-compose.softlaunch.yml` in both trees. The edge does not glob-mount
   `conf.d`; a file copied into `nginx/` is invisible until it is mounted.
4. Recreate only the edge with
   `sudo bash /opt/lv24-src/lv24/main/infra/scripts/recreate-edge-nginx.prod.sh`.
   Never use a core-only compose recreate: it publishes `4100:80` instead of
   `80:80`/`443:443` and takes the public site down.
5. Issue the certificate through the `certbot` Compose profile, not a host
   `certbot` that writes to `/etc/letsencrypt`.
6. Run the first deploy (below) and install the CSP hashes.

## Normal deploy

```sh
bash scripts/deploy-prod.sh
```

What it does:

1. `npm ci`.
2. `npm run lint` and `npm test`.
3. `npm run docs:build` with `DOCS_SITE_URL=https://seo.lv24.by` (override the
   environment variable for a staging origin).
4. Hashes the stable inline scripts, prints them, and verifies them against
   `deploy/csp-hashes.txt` when present.
5. Packs `docs/.vitepress/dist` into `/tmp/lv24-seo-docs.tgz`, uploads it and
   extracts it to `/opt/lv24-sites/lv24-seo-site/root.new`.
6. Renames the current `root` to `root.prev-<ts>`, moves `root.new` to `root`
   and fixes permissions. If the final rename fails, the previous `root` is
   restored before the script exits.
7. Requests `/`, `/ru/`, `/zh/` and `/reference/cli/`.

The container mounts the parent `/opt/lv24-sites/lv24-seo-site`, so it sees the
renamed `root` immediately. A content-only deploy needs no nginx reload.

Windows without Git Bash/WSL: build with npm, then upload with
`powershell -File scripts/upload-prod.ps1`. That path skips the build gates and
the CSP check; use the full script when possible.

Build for another origin (canonical URLs, `hreflang` and the sitemap):

```sh
DOCS_SITE_URL=https://staging.example npm run docs:build
```

`deploy-prod.sh` passes `DOCS_SITE_URL` to the build and uses the same value for
its post-deploy checks; it still uploads to the `lv24` host unless you pass a
different SSH alias.

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

Also open the site with the browser devtools console: no CSP violations and no
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
reload is needed for a directory swap. Then repeat the verification URLs.

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

## CSP hashes

VitePress emits two stable inline scripts (the theme bootstrap and macOS
detection) on every page. `scripts/deploy-prod.sh` hashes them, prints the
values and, if `deploy/csp-hashes.txt` exists, fails when a computed hash is not
listed there. The committed `deploy/csp-hashes.txt` contains the current values;
put the same values into the nginx CSP and reload nginx. A VitePress upgrade
that changes either script requires updating both the hash file and the vhost.

Containerized edge:

```sh
sudo docker exec lv24-city-edge-nginx nginx -t
sudo docker exec lv24-city-edge-nginx nginx -s reload
```

Bare metal:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

## Bare-metal fallback

Use this only when the site is not served by the `lv24-city-edge-nginx`
container. The production path is [`vps-edge.md`](./vps-edge.md).

### 1. DNS

Create an `A` record (and `AAAA` if the VPS has IPv6) for `seo.lv24.by`. Wait
for it to resolve before requesting a certificate:

```sh
dig +short seo.lv24.by
```

### 2. Directories and ACME webroot

```sh
sudo install -d -m 755 /opt/lv24-sites/lv24-seo-site
sudo install -d -m 755 /var/www/certbot
```

### 3. Bootstrap HTTP vhost for the certificate

The full vhost references certificate files that do not exist yet. Install a
minimal HTTP-only server first:

```sh
sudo tee /etc/nginx/conf.d/seo.lv24.by.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name seo.lv24.by;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        access_log off;
        try_files $uri =404;
    }

    location / {
        return 301 https://seo.lv24.by$request_uri;
    }
}
EOF
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Certificate

```sh
sudo certbot certonly --webroot -w /var/www/certbot -d seo.lv24.by \
  --deploy-hook "systemctl reload nginx"
```

The certificate lands in `/etc/letsencrypt/live/seo.lv24.by/`. Check renewal:

```sh
sudo certbot renew --dry-run
```

### 5. Install the full vhost

```sh
cp deploy/nginx.seo.lv24.by.conf.example /tmp/seo.lv24.by.conf
# edit /tmp/seo.lv24.by.conf: root -> /opt/lv24-sites/lv24-seo-site/root,
# TLS paths -> /etc/letsencrypt/live/seo.lv24.by/...; CSP hashes come in step 6
scp /tmp/seo.lv24.by.conf lv24:/tmp/seo.lv24.by.conf
ssh lv24 'sudo install -m 644 /tmp/seo.lv24.by.conf /etc/nginx/conf.d/seo.lv24.by.conf \
  && sudo nginx -t && sudo systemctl reload nginx'
```

### 6. First deploy

Run the gated deploy:

```sh
bash scripts/deploy-prod.sh
```

If the build prints a different hash, the deploy stops before upload. Update
`deploy/csp-hashes.txt` and the `script-src` directive in the installed vhost,
reload nginx, and re-run the deploy.

## Operations and security

- Certificates renew through the edge certbot profile (container) or the certbot
  timer (bare metal). A renewal must write to the tree the edge mounts;
  `certbot renew --dry-run` is safe to run at any time.
- The vhost allows `GET`/`HEAD` only, denies framing, sets HSTS, `nosniff`, a
  referrer policy and a permissions policy, and serves scripts, styles, fonts,
  images and connections from the same origin only.
- There are no external fonts, CDNs, analytics or paid services. Brotli is
  optional and must stay commented out unless nginx was built with
  `ngx_brotli`.
- `version.json` is `no-store`; hashed files under `/assets/` are cached for a
  year. HTML is revalidated.
- No secrets belong in this repository or in the deploy scripts. The SSH alias
  and `sudo` are the only credentials involved; `deploy/csp-hashes.txt` contains
  public hashes.
