# Filmpost

A local, single-user web app for taking a finished film haiku review through to
publication. Built for the `rathbone.dev` film review pipeline.

## What it does

- Takes title, year, haiku, rating, and extended notes
- Looks up the poster via TMDB when you click "Look up poster" (top match, flags
  low-confidence)
- Auto-posts to Bluesky (with an in-app confirmation before it sends)
- Gives copy-ready, correctly formatted blocks for Notion, Ghost, Letterboxd,
  IMDb, and Rotten Tomatoes, plus a one-click search link for each so you can
  paste straight into the right page
- Import: open the film's Notion record and click "Open in Filmpost" (or
  paste its "Filmpost Import" value), and Filmpost fills in title, year,
  rating, haiku, notes, and watched date in one go. If the record has no poster
  URL, click "Look up poster" afterwards. The Notion record is created by the
  `film-haiku-draft` Claude skill once the final haiku is chosen
- Tracks which platforms you've marked "posted" and gives you a ready-to-paste
  Status and Platforms value for the Notion record, paste straight into the
  table view cells, comma-separated values create/select multi-select tags
  automatically, no need to touch Notion's schema
- Enforces house style: no em dashes (flags them if found), rating tags in
  the `#rating-X-X` format, `#filmreviewhaiku` hashtag on Bluesky

IMDb and Rotten Tomatoes are off by default, toggle them on per review.

## Why Notion and Ghost aren't automated

Both the Notion API and the Ghost Admin API block direct requests from
browser JavaScript (no CORS headers on either), so a pure client-side app
like this one cannot post to them directly without a backend. Rather than
add a server, those two stay copy-paste. TMDB and Bluesky's AT Protocol are
both designed for browser use and work directly.

## Running it

```
npm install
npm run dev
```

Then open the local URL it prints (usually `http://localhost:5173`).

For a production build:

```
npm run build
npm run preview
```

## Deploying to GitHub Pages

This repo includes `.github/workflows/deploy.yml`, which builds and deploys
automatically on every push to `main`.

1. Create a new GitHub repo and push this folder to it
2. In the repo's Settings > Pages, set **Source** to **GitHub Actions**
3. Push to `main` (or run the workflow manually from the Actions tab)
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two

It's a static site with no backend, so GitHub Pages' free tier covers it
completely, no server costs, no database.

One thing to know: your TMDB key and Bluesky app password only ever live in
*your own browser's* local storage, they aren't part of the deployed site
and nobody else visiting the URL would see them, but they also don't follow
you between browsers/devices since nothing is synced server-side.

## Keys

Click the gear icon to add:

- A TMDB API key (v3) — free, from themoviedb.org/settings/api
- Your Bluesky handle and an app password (not your main password) —
  generate one at bsky.app under Settings > App Passwords

Both are stored only in this browser's local storage unless you turn off
"Remember these" in settings, in which case nothing is saved and you'll
re-enter them each session.
