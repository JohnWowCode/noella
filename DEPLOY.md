# Getting Noella onto your phone

Noella has no server. Every page is prerendered and your notes live in your
browser, so publishing it is just putting a folder of files somewhere.

```bash
npm install
npm run export     # writes ./out — about 1.3 MB
```

That folder **is** the app. It does not care where it is hosted.

---

## Option 1 — GitHub Pages, automatic

Uses the repository you already have. No new account, no third party, and it
republishes every time you push.

**One-time setup — one switch, and it is the only thing not already done:**

1. Open **https://github.com/JohnWowCode/noella/settings/pages**
2. Under **Source**, choose **GitHub Actions**
3. Go to the **Actions** tab, open the latest **Publish** run, and hit
   **Re-run failed jobs**

The workflow is committed and the build half already passes. Until Pages is
switched on, the deploy step fails with `Failed to create deployment
(status: 404) … Ensure GitHub Pages has been enabled` — that error means only
the switch is missing, not that anything is broken.

After that, every push republishes to:

```
https://<your-username>.github.io/noella/
```

Pages serves from a subdirectory, which the build handles — the workflow passes
`BASE_PATH=/noella` so every asset, the manifest and the service worker resolve
correctly there. Verified: the whole app, offline included, runs under a
subfolder.

---

## Option 2 — drag a folder, 30 seconds

If you want a URL right now without touching settings:

1. **[netlify.com/drop](https://app.netlify.com/drop)**
2. Drag the `out` folder onto the page

No signup. You get a URL immediately. Make a free account afterwards if you want
to keep it. To update, run `npm run export` and drag the new folder on.

---

## Option 3 — anywhere else

`out` is plain HTML, CSS, JS and images. It will work on Cloudflare Pages,
Codeberg Pages, an S3 bucket, a Raspberry Pi running nginx, or any web host you
already pay for. Upload the contents of `out` and you are done.

The only requirements are that it serves `index.html` from directories and that
it is on **HTTPS** — browsers refuse to install a web app or run a service
worker without it.

---

## Check it first

```bash
npx serve out
```

Opens on `http://localhost:3000`, serving the folder the same dumb way a static
host does. If it works here it works there.

To see your phone's view without publishing, `npx serve out -l 3000` and visit
your laptop's IP from your phone on the same wifi. Good enough to feel it,
though install-to-home-screen and offline need real HTTPS.

---

## Once it's on HTTPS

- **Install it.** Open it on your phone, then "Add to Home Screen". It opens
  without browser chrome and behaves like an app.
- **It works with no signal.** The service worker caches the pages. Your notes
  were always local anyway.
- **Share into it.** Once installed, Noella appears in the Android share sheet —
  share a link or some text and the capture box opens with it filled in.

## Where your notes actually live

In the browser you use it in, not on the host. So:

- Publishing does **not** upload your notes anywhere.
- Your phone and your laptop are separate walls until there is a real backend.
- **Use `Export`.** It writes one JSON file with your images inlined, and
  `Import` restores it. That is your backup, and it is also how you move a wall
  from your laptop to your phone.
