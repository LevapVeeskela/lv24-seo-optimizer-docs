# Adding `seo.lv24.by` to the containerized LV24 edge

The production edge is not a host nginx service. It is the `lv24-city-edge-nginx`
container in the `lv24-city` Compose project. The generic steps in
[`README.md`](./README.md) work for a bare-metal nginx; this page records the
exact container wiring observed on the LV24 VPS so the first deploy does not
guess.

## What is mounted today

`docker inspect lv24-city-edge-nginx` shows:

| Host path | Container path | Mode |
|---|---|---|
| `/opt/lv24-releases/<release>/lv24/main/infra/nginx/*.conf` | `/etc/nginx/conf.d/*.conf` | read-only |
| `/opt/lv24-sites/lv24-brain-site` | `/srv/brain-site` | read-only |
| `/opt/lv24-src/lv24/main/infra/nginx/letsencrypt` | `/etc/nginx/certs` | read-only |
| `/opt/lv24-src/lv24/main/infra/nginx/certbot-www` | `/var/www/certbot` | read-only |

The Compose project files live under
`/opt/lv24-releases/<release>/lv24/main/infra/` (the active release at the time
of writing was `20260802T215329Z-local`). The service name is `nginx` in the
`lv24-city` project.

## One-time changes

1. Create the site directory on the host:

   ```sh
   sudo install -d -m 755 /opt/lv24-sites/lv24-seo-site
   ```

2. Add the vhost file to the active nginx config directory. Copy
   [`nginx.seo.lv24.by.conf.example`](./nginx.seo.lv24.by.conf.example) as
   `seo.lv24.by.conf`, then change:

   - `root /opt/lv24-sites/lv24-seo-site/root` to
     `root /srv/seo-site/root` (the container path);
   - the certificate paths to
     `/etc/nginx/certs/live/seo.lv24.by/{fullchain,privkey}.pem`;
   - the two CSP hashes after the first build (see below).

3. Add two bind mounts to the edge service in the Compose override used by the
   active release. The exact file is release-specific; use the one from
   `docker inspect` (`com.docker.compose.project.config_files`) and add:

   ```yaml
   services:
     nginx:
       volumes:
         - /opt/lv24-sites/lv24-seo-site:/srv/seo-site:ro
         - /opt/lv24-releases/<release>/lv24/main/infra/nginx/seo.lv24.by.conf:/etc/nginx/conf.d/seo.lv24.by.conf:ro
   ```

   Mount the parent directory, not `root` itself: `scripts/deploy-prod.sh`
   renames `root` on every deploy, and a bind mount of `root` would keep the
   old inode.

4. Recreate only the edge container so the new mounts appear:

   ```sh
   cd /opt/lv24-releases/<release>/lv24/main/infra
   sudo docker compose -p lv24-city \
     -f docker-compose.yml \
     -f docker-compose.core.yml \
     -f docker-compose.services.yml \
     -f docker-compose.domains.yml \
     -f docker-compose.logging.yml \
     -f docker-compose.ai.yml \
     -f docker-compose.ops.yml \
     -f docker-compose.ops-ha.yml \
     -f docker-compose.prod.yml \
     -f docker-compose.softlaunch.yml \
     up -d --no-deps nginx
   ```

   `--no-deps` is deliberate: it must not restart unrelated services.

5. Issue the certificate with the existing webroot. The ACME webroot is mounted
   at `/var/www/certbot`; run certbot on the host or in the certbot container
   that already owns `/opt/lv24-src/lv24/main/infra/nginx/letsencrypt`:

   ```sh
   sudo certbot certonly --webroot \
     -w /opt/lv24-src/lv24/main/infra/nginx/certbot-www \
     -d seo.lv24.by
   ```

   The live files must end up at
   `/opt/lv24-src/lv24/main/infra/nginx/letsencrypt/live/seo.lv24.by/` so the
   container sees them under `/etc/nginx/certs/live/seo.lv24.by/`.

6. Validate and reload:

   ```sh
   sudo docker exec lv24-city-edge-nginx nginx -t
   sudo docker exec lv24-city-edge-nginx nginx -s reload
   ```

## First deploy and CSP

```sh
DOCS_SITE_URL=https://seo.lv24.by npm run docs:build
bash scripts/deploy-prod.sh
```

`deploy-prod.sh` prints the two stable inline-script hashes and writes
`deploy/csp-hashes.txt` when it is missing. Copy the two values into the
`script-src` directive of the installed vhost, reload nginx, and re-run the
deploy so the hash gate is enforced.

## Rollback

The deploy script keeps the previous directory:

```sh
ls -1 /opt/lv24-sites/lv24-seo-site
# root  root.prev-20261114T213000Z
sudo mv root root.bad-<ts>
sudo mv root.prev-<ts> root
sudo docker exec lv24-city-edge-nginx nginx -s reload
```

Forward-fix is preferred for content mistakes; the directory swap is for a
broken build.

## Zero-spend notes

- DNS, certbot, nginx and the existing VPS are already paid for; this adds no
  new service.
- The site is static: no database, no Node runtime, no external fonts, CDNs or
  analytics.
- The edge container serves only files from the mounted directory.
