# Deploying KUIPER (Standard MERN: PM2 + Nginx)

This deployment architecture is a standard MERN stack with zero Docker dependencies:
- **Backend**: Managed by PM2 in fork mode via `ecosystem.config.js`. Connects directly to MongoDB (`MONGO_URI`).
- **Frontend**: Static production build served directly by Nginx with gzip/brotli precompression.
- **Reverse Proxy**: Nginx handles SSL termination, static SPA routing, and API proxying using configs in `deploy/nginx/`.

Files:

| File | Goes to | Purpose |
|---|---|---|
| `deploy/nginx/kuiperapp.co.in.conf` | `/etc/nginx/sites-available/` | frontend: HTTP/2, gzip (+ brotli if installed), 1-year cache for `/assets`, `no-cache` for `index.html`, SPA fallback |
| `deploy/nginx/api.kuiperapp.co.in.conf` | `/etc/nginx/sites-available/` | API + socket.io proxy to `127.0.0.1:5000` with keep-alive and timeouts |
| `ecosystem.config.js` | repo root (stays there) | PM2: fork mode, 1 instance, graceful reload |
| `deploy/deploy.sh` | repo (run it) | pull, install, build into a new folder, atomic switch, `pm2 reload` |
| `backend/scripts/ensureIndexes.js` | repo (run once) | creates the new MongoDB indexes |

The paths in the files assume:

- repo checkout: `/var/www/kuiper/app` (`REPO_DIR` in `deploy.sh`)
- live frontend: `/var/www/kuiper/current` → a symlink to `/var/www/kuiper/releases/<time>`
- certificates from certbot in `/etc/letsencrypt/live/<domain>/`

If yours differ, change `REPO_DIR` / `WEB_DIR` at the top of `deploy.sh` (or pass them as
environment variables) and the `root` / `ssl_certificate` lines in the two nginx files.

## One-time checklist (in this order)

**1. Back up what you have now**

```bash
sudo cp -r /etc/nginx/sites-available /etc/nginx/sites-available.bak-$(date +%F)
mongodump --uri "$MONGO_URI" --out ~/backup-$(date +%F)
```

**2. Pull the new code** (as today)

```bash
cd /var/www/kuiper/app && git fetch && git reset --hard origin/main
cd backend && npm ci --omit=dev
```

**3. Create the database indexes** (check first, then create; safe to run again)

```bash
cd /var/www/kuiper/app/backend
node scripts/ensureIndexes.js
node scripts/ensureIndexes.js --confirm
```

**4. First frontend release folder + symlink.** Point nginx at the symlink, not at `dist/`:

```bash
sudo mkdir -p /var/www/kuiper/releases && sudo chown -R $USER /var/www/kuiper
cd /var/www/kuiper/app/frontend && npm ci && npm run build
cp -r dist /var/www/kuiper/releases/first
ln -sfn /var/www/kuiper/releases/first /var/www/kuiper/current
```

**5. Nginx**

```bash
sudo cp deploy/nginx/kuiperapp.co.in.conf deploy/nginx/api.kuiperapp.co.in.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/kuiperapp.co.in.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.kuiperapp.co.in.conf /etc/nginx/sites-enabled/
# disable the old site files for the same domains so they don't conflict
ls -l /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Optional brotli: `sudo apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static`,
uncomment the `brotli` lines in `kuiperapp.co.in.conf`, then `sudo nginx -t && sudo systemctl reload nginx`.

**6. PM2: switch to the ecosystem file** (one short restart)

```bash
cd /var/www/kuiper/app
pm2 delete kuiper-backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # only if PM2 is not yet started on boot; run the command it prints
```

**7. Check**

```bash
curl -sI https://kuiperapp.co.in/ | grep -i -E "cache-control|content-encoding"
curl -sI -H "Accept-Encoding: gzip" https://kuiperapp.co.in/assets/$(ls /var/www/kuiper/current/assets | grep -m1 '^index-.*\.js$') | grep -i -E "cache-control|content-encoding"
curl -s -o /dev/null -w "%{http_code} %{size_download} bytes\n" -H "Accept-Encoding: gzip" https://api.kuiperapp.co.in/api/auth/login -X POST -H "Content-Type: application/json" -d '{}'
pm2 logs kuiper-backend --lines 30
```

Expected: `index.html` → `Cache-Control: no-cache`; `/assets/...js` → `max-age=31536000, immutable` and
`Content-Encoding: gzip` (or `br`); API → `401` (no credentials) without errors in the logs.

## Every deploy after that

```bash
cd /var/www/kuiper/app && bash deploy/deploy.sh
```

No `kill -9` on port 5000 any more: `pm2 reload` sends SIGINT, the API finishes in-flight requests
and exits, PM2 starts the new one and waits for its "ready" signal. With one instance this is still a
~1–2 s restart (see the comment in `ecosystem.config.js` for why cluster mode is not safe yet).

**Rollback** (frontend): `ls /var/www/kuiper/releases`, then
`ln -sfn /var/www/kuiper/releases/<older> /var/www/kuiper/current.tmp && mv -Tf /var/www/kuiper/current.tmp /var/www/kuiper/current`.
Backend: `git reset --hard <previous commit> && pm2 reload ecosystem.config.js`.

## Check that MongoDB uses the indexes

```js
// mongosh, in the kuiper database
db.tickets.find({ assignedTo: ObjectId("<a user id>") }).sort({ createdAt: -1 }).limit(25).explain("executionStats")
```

Look for `IXSCAN` (not `COLLSCAN`) in `winningPlan`, and `totalDocsExamined` close to `nReturned`.
