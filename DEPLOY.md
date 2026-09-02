# Getting Noella onto your phone

Noella has no server. Every page is prerendered and all your data lives in your
browser, so publishing it is just putting a folder of files somewhere.

```bash
npm install
npm run export     # writes ./out — about 1.3 MB
```

That folder **is** the app. Pick whichever of these sounds least annoying.

---

## The lazy one — no account, 30 seconds

1. Go to **[netlify.com/drop](https://app.netlify.com/drop)**
2. Drag the `out` folder onto the page
3. You get a URL. Open it on your phone.

No signup, no git, no settings. If you want to keep the URL, make a free
account afterwards and it stays.

To update later: run `npm run export` again and drag the new folder on.

---

## The one that updates itself — Vercel

Worth it once you're using it daily, because it redeploys whenever you push.

1. **vercel.com → Add New → Project → import `noella`**
2. When it asks which branch, pick the one your work is on
3. Deploy. Nothing to configure — no environment variables, no build settings.

Vercel runs `npm run build` (the normal one, not the export) and serves it. Both
work; the export just also happens to work anywhere else.

---

## Check it before you publish

```bash
npx serve out
```

Then open `http://localhost:3000`. This serves the folder the same dumb way a
static host does, so if it works here it works there.

---

## Once it's on HTTPS

Three things switch on that only work on a real domain:

- **Install it.** Open it on your phone, then "Add to Home Screen". It opens
  without browser chrome and behaves like an app.
- **It works with no signal.** The service worker caches the pages; your notes
  were always local anyway.
- **Share into it.** Once installed, Noella appears in the Android share sheet.
  Share a link or some text and the capture box opens with it already filled in.

## Where your notes actually live

In the browser you use it in — not on the host. That means:

- Publishing does **not** upload your notes anywhere.
- Your phone and your laptop are separate walls until there is a real backend.
- **Use `Export`** now and then. It writes one JSON file with your images
  inlined, and `Import` restores it. That is also how you move a wall from your
  laptop to your phone.
