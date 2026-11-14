# Deploying `seo.lv24.by`

Static VitePress site behind the LV24 edge nginx. The build is a directory of
files; there is no application server, database, or runtime process. Deploys
run from a checkout, upload a tarball over SSH and swap the vhost root
atomically.

Files in this directory:

- `nginx.seo.lv24.by.conf.example` — HTTP redirect, TLS, static-file vhost,
  cache headers, security headers and the hash-pinned CSP.
- `csp-hashes.txt` — the two stable inline-script hashes allowed by the CSP,
  generated from the VitePress 1.6.4 build. `csp-hashes.txt.example` documents
  the format.
- `README.md` — this runbook.
- `vps-edge.md` — exact wiring for the containerized `lv24-city-edge-nginx`
  on the LV24 VPS (bind mounts, Compose service, certificate paths).

## Prerequisites

- DNS for `seo.lv24.by` pointing at the VPS (A and/or AAAA).
- nginx and certbot installed on the VPS (`nginx`, `certbot` packages are free).
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

## First-time VPS setup

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

The deploy script creates `root`, `root.new` and `root.prev-<ts>` below
`/opt/lv24-sites/lv24-seo-site`; the parent must exist and be writable by
`sudo`.

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

Copy the sample locally, adjust the TLS paths if needed and install it. The CSP
hashes are already set for VitePress 1.6.4 and match `deploy/csp-hashes.txt`:

```sh
cp deploy/nginx.seo.lv24.by.conf.example /tmp/seo.lv24.by.conf
# edit /tmp/seo.lv24.by.conf: TLS paths only; CSP hashes come in step 6
scp /tmp/seo.lv24.by.conf lv24:/tmp/seo.lv24.by.conf
ssh lv24 'sudo install -m 644 /tmp/seo.lv24.by.conf /etc/nginx/conf.d/seo.lv24.by.conf \
  && sudo nginx -t && sudo systemctl reload nginx'
```

If nginx runs in a container (the `brain.lv24.by` pattern), mount
`/opt/lv24-sites/lv24-seo-site` read-only into the container and change the
vhost root to the mount point, for example `/srv/seo-site/root`. Mount the
parent directory, not `root` itself, so the atomic swap stays visible without
recreating the container. Adjust the certificate paths to the mounted cert
directory as well.

### 6. First deploy and CSP hashes

`deploy/csp-hashes.txt` already contains the two hashes for the VitePress 1.6.4
build, and the sample vhost has the same values. Run the gated deploy:

```sh
bash scripts/deploy-prod.sh
```

If the build prints a different hash, the deploy stops before upload. Update
`deploy/csp-hashes.txt` and the `script-src` directive in the installed vhost,
reload nginx, and re-run the deploy:

```sh
# bare metal:
ssh lv24 'sudo nginx -t && sudo systemctl reload nginx'
# containerized edge:
ssh lv24 'sudo docker exec lv24-city-edge-nginx nginx -t && sudo docker exec lv24-city-edge-nginx nginx -s reload'
bash scripts/deploy-prod.sh
```

A VitePress upgrade that changes either inline script will fail the deploy until
both the hash file and the vhost are updated.

## Normal deploy

```sh
bash scripts/deploy-prod.sh
```

What it does:

1. `npm ci` and `npm run docs:build` with
   `DOCS_SITE_URL=https://seo.lv24.by` (override with the environment variable
   for a staging origin).
2. `npm run lint` and `npm test`.
3. Hashes the stable inline scripts, prints them, and verifies them against
   `deploy/csp-hashes.txt` when present.
4. Packs `docs/.vitepress/dist` into `/tmp/lv24-seo-docs.tgz`, uploads it and
   extracts it to `/opt/lv24-sites/lv24-seo-site/root.new`.
5. Renames the current `root` to `root.prev-<ts>`, moves `root.new` to `root`
   and fixes permissions.
6. Requests `/`, `/ru/`, `/zh/` and `/reference/cli/`.

Windows without Git Bash/WSL: build with npm, then upload with
`powershell -File scripts/upload-prod.ps1`. That path skips the build gates and
the CSP check; use the full script when possible.

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

Replace `root.prev-20261114T120000Z` with the directory you want. Then repeat
the verification URLs. To roll back without renaming, point the vhost `root`
at the previous directory and reload nginx; the rename above keeps the site
layout predictable and is preferred.

Prune old directories only after the rollback is confirmed:

```sh
ssh lv24 'sudo find /opt/lv24-sites/lv24-seo-site -maxdepth 1 -type d -name "root.prev-*" -mtime +14 -print'
```

Review the list before deleting anything; keep at least the last known-good
build.

## Operations and security

- Certificates renew through the certbot timer; the deploy hook reloads nginx.
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
