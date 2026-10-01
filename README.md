# 3310.nz

One Next.js app on Vercel serving four sites, picked by subdomain:

| Host | What it is | Who can see it |
| --- | --- | --- |
| `3310.nz` | Front page styled like an old phone, with a ringtone/MP3 player, Snake and an optional SoundCloud/Spotify/YouTube embed. Also serves short links `3310.nz/s/<code>` and files `3310.nz/f/<id>`. | Everyone |
| `portfolio.3310.nz` | Private gallery. Work is uploaded at `/manage`. | Portfolio password to view, manage password to upload |
| `drop.3310.nz` | URL shortener + file host dashboard. Its link preview image is `public/drop-og.png`. | Drop password |
| `old.3310.nz` | Neocities-style news & updates board. Log in at `/login` to post, edit and delete. | Public to read, admin to post |

## How the private parts stay private

- Logging in sets a **signed, HttpOnly cookie**. It's an HMAC over a secret that only exists on the server, so editing cookies or anything else in DevTools can't fake it.
- Every protected page **and** every API route checks that cookie on the server before it returns any data. The proxy's redirect to `/login` is only a convenience, not the real gate.
- Portfolio images live in a **private** Vercel Blob store, and there's no public URL for any image. The browser only ever gets `/api/portfolio/img?p=…`, which streams the file after checking your session, so a copied link won't work for anyone who isn't logged in.
- Cookies are per-subdomain, so a portfolio login doesn't unlock drop, and drop doesn't unlock portfolio.
- Each section has its own password. Changing a password logs out everyone who signed in with the old one.
- Login is rate-limited to 8 failed tries per 15 minutes per IP.
- Uploaded files that could run code (HTML, SVG, JS…) are always sent as downloads with a sandbox CSP, so they can't run scripts on 3310.nz.

Nothing can stop someone who *is* logged in from screenshotting an image. Disabling right-click and drag only stops casual saving.

## Setup on Vercel

1. **Import the repo** at vercel.com → Add New → Project → pick `3310`. Use the default settings (Next.js).
2. **Storage → Create → Blob** and set access to **Private**. Connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
3. **Storage → Marketplace → Upstash → Redis** (free plan is fine). Connect it to the project. This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
4. **Settings → Environment Variables**: add these (see `.env.example`):
   - `SESSION_SECRET`: 32+ random characters. Generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - `PORTFOLIO_PASSWORD`
   - `PORTFOLIO_MANAGE_PASSWORD`
   - `DROP_PASSWORD`
   - `CRON_SECRET`: any random string. Lets the daily cron in `vercel.json` delete expired drop files.
   - `ADMIN_PASSWORD` for old.3310.nz (the admin username is `nokia`; set `ADMIN_USERNAME` to change it)
5. **Settings → Domains**: add `3310.nz`, `www.3310.nz`, `portfolio.3310.nz`, `drop.3310.nz` and `old.3310.nz`.
6. **Cloudflare DNS** (leave the Proton Mail MX/TXT/DKIM records alone):

   | Type | Name | Target | Proxy |
   | --- | --- | --- | --- |
   | A | `@` | `76.76.21.21` | DNS only (grey cloud) |
   | CNAME | `www` | `cname.vercel-dns.com` | DNS only |
   | CNAME | `portfolio` | `cname.vercel-dns.com` | DNS only |
   | CNAME | `drop` | `cname.vercel-dns.com` | DNS only |
   | CNAME | `old` | `cname.vercel-dns.com` | DNS only |

   If Vercel's domain page shows different values, use the ones it shows.
7. Redeploy after adding env vars (Deployments → … → Redeploy).

## Everyday use

- **Music**: edit `site.config.ts`. Put MP3s in `public/music/` and add `{ title, artist, src: "/music/file.mp3" }`. To show an embed under the phone, paste a SoundCloud, Spotify or YouTube link into `embed`. Anything in `public/` is public, so only put music there.
- **Portfolio**: go to `portfolio.3310.nz/manage` and log in with the manage password.
- **News post**: go to `old.3310.nz/login`, then use "+ new post". Posts support `**bold**`, `*italic*`, `[link](https://…)`, `![img](https://…)`, `# heading`, `- list` and `> quote`.
- **Short link / file**: go to `drop.3310.nz`. You can drag files anywhere on the page (500 MB max each). Each upload is either a permanent link or deleted after 24 hours, chosen on the Files tab. The same tab has a **videos** switch: "compress to 480p 60fps" re-encodes videos in your browser (H.264 MP4, short side capped at 480 px, frame rate capped at 60) before they upload, which needs Chrome, Edge or another browser with WebCodecs. The bar at the top shows how much of the Blob store is left (1 GB on the Hobby plan; set `BLOB_QUOTA_GB` if that changes).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in passwords + Redis/Blob tokens (vercel env pull works too)
npm run dev
```

Then open `http://localhost:3000`, `http://portfolio.localhost:3000`, `http://drop.localhost:3000` and `http://old.localhost:3000`. Browsers resolve `*.localhost` automatically.

## Files

```
proxy.ts               subdomain → folder routing + login redirects
site.config.ts         front-page settings (tracks, embed)
lib/session.ts         signed cookie tokens
lib/auth.ts            server-side session checks
app/page.tsx           3310.nz front page        components/nokia/*  phone UI, player, snake
app/portfolio/*        portfolio.3310.nz
app/drop/*             drop.3310.nz              app/s, app/f       public short links / files
app/old/*              old.3310.nz
app/api/*              JSON endpoints (all re-check auth)
```

## Credits

`public/nokia.png` is a resized copy of [Nokia 3310 Blue R7309170 (retouch).png](https://commons.wikimedia.org/wiki/File:Nokia_3310_Blue_R7309170_(retouch).png) by smial on Wikimedia Commons, under the [Free Art License](https://artlibre.org/licence/lal/en/). The credit line on the front page has to stay while that image is used. The screen and key positions in `app/nokia.css` and `components/nokia/Phone.tsx` are percentages of that photo, so they need re-measuring if the image is swapped.
