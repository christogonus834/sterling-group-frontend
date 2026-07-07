# Sterling Group — Frontend

Static multi-page site (plain HTML/CSS/JS, no build step) for Sterling
Group's public pages, Lakeview Apartments, Sterling Specialist Hospital, and
the admin panel. The API lives in a separate repo, deployed to Render.

## Before you deploy

Open `js/config.js` and replace the placeholder with your actual Render
backend URL:

```js
window.API_BASE_URL = (function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (isLocal) return '';
  return 'https://sterling-group-backend.onrender.com/'; // <-- change this
})();
```

You'll only know this URL once the backend is deployed on Render — deploy
the backend first, then come back and set this, then deploy the frontend.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New** → **Project** → import this repo.
3. Framework preset: **Other** (it's a static site, no build command needed).
   - **Build Command:** leave empty
   - **Output Directory:** leave as default (repo root)
4. Deploy. Vercel gives you a URL like `https://sterling-group.vercel.app`.
5. Go back to the **backend's** Render environment variables and set
   `CLIENT_ORIGIN` to this exact Vercel URL, then redeploy the backend so
   CORS and cookies allow requests from it.

## Local development

Since there's no build step, you can open these files directly, but they're
designed to be served by the backend's Express server locally (which also
serves `/public` in dev) — see the backend repo's README. Alternatively,
serve this folder with any static file server, e.g. `npx serve .`.

## Friendly URLs

`vercel.json` handles the clean URLs used across the site (`/lakeview`,
`/hospital`, `/admin`, `/lakeview/payment-callback`) by rewriting them to
their `.html` files.
