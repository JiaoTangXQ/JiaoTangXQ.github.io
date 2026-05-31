# Server Deployment

This branch is the server-hosted version of 焦糖星球.

Production defaults:

- Site URL: `http://121.40.108.230`
- npm registry: `https://registry.npmmirror.com`
- App checkout: `/opt/jiaotang-planet`
- Web root: `/var/www/jiaotang-planet`
- Nginx config: `/etc/nginx/sites-available/jiaotang-planet.conf`

Deploy on the server as root:

```bash
SITE_URL=http://121.40.108.230 bash scripts/deploy-server.sh
```

Use a domain later by setting `SITE_URL=https://example.com` and updating
`deploy/nginx/jiaotang-planet.conf` `server_name`.

Override the npm registry if needed:

```bash
NPM_REGISTRY=https://registry.npmjs.org SITE_URL=http://121.40.108.230 bash scripts/deploy-server.sh
```

If the checkout has already been updated by another transport, skip the GitHub
fetch step:

```bash
SKIP_GIT_FETCH=1 SITE_URL=http://121.40.108.230 bash scripts/deploy-server.sh
```
