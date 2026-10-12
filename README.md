# Baby Habermann · The Arrival Club

Website: **https://jcjackch.github.io/baby-habermann-arrival-club/**

An arrival prediction pool, real Saarbrücken cake menu, shared gift ideas, and upvotes for the Habermann family.

## What runs where

- GitHub Pages serves the React website. Pushes to `main` run tests, build it, and publish it through GitHub Actions.
- The existing Sites server at `https://baby-habermann-arrival-club.jackchan08.chatgpt.site` stores guesses, gifts, votes, and the recorded arrival in its persistent D1 database. Existing records stay there.
- `app/api/`, `db/`, and `drizzle/` contain the server source and migration history for reference and maintenance. GitHub Pages does **not** execute these server routes. Server changes must also be deployed to the existing Sites project; the Pages workflow deploys the frontend only.
- The API accepts requests from `https://jcjackch.github.io`. Browser identity is a random ID kept in local storage, sent in `X-Arrival-Visitor`; no third-party cookie or GitHub login is needed. The original hosted page continues using its cookies. An old site's browser receipt is separate from the GitHub Pages browser receipt; registered names remain unique in the shared pool.
- The site and shared entries are public. Votes use a friendly one-per-browser rule, not verified personal identity.

## Features

- Expected date: 6 October 2026. Guess dates run through 6 November, with a whole hour in Berlin time.
- Contributions: €5, €10, €15, or €20, collected separately by the organizer. Half goes to the winner and half to the birthday cake.
- The closest predicted time wins; equal-distance winners share the prize. Entries at or after the recorded birth are excluded.
- Equal cake and gift columns, stacked on mobile. Visitors can add gift names, links, notes, and their names.
- One upvote option for Cake as a whole, one for the Elversberg bodysuit, and one for each added gift. Tap again to undo. Shared data refreshes every 30 seconds.
- Organizer controls require the existing server-side `ORGANIZER_CODE` secret. No organizer secret, database export, visitor IDs, or private files are committed here.

## Local development

Use Node.js 24 or later:

```sh
npm ci
npm test
npm run build
npm run dev
```

The Pages base path is configured in `vite.config.ts`. `ARRIVAL_API_URL` can override the public API URL at build time. A local server's origin is intentionally not in the production API allowlist; tests use a local SQLite database without changing live data. To test against a development API, run that API separately, allow the local origin there, and set `ARRIVAL_API_URL` accordingly.

## Deployment

Repository Settings → Pages → Source must be **GitHub Actions**. `.github/workflows/pages.yml` runs the build and publishes `dist/` with the correct `/baby-habermann-arrival-club/` asset path.

The full workflow needs only the normal automatically provided GitHub Actions token. Keep `ORGANIZER_CODE` on the server, never in repository variables or frontend build settings.

## Cake and gift sources

Cake menu: [Café Lolo’s official Sortiment PDF](https://cafe-lolo.de/images/sortiment.pdf), checked 9 October 2026. Address: Heuduckstraße 67, 66117 Saarbrücken.

| Whole cake | Published price | Menu page |
| --- | ---: | ---: |
| Käsekuchen, small | €15 | 1 |
| Bienenstich, small | €20 | 2 |
| Pistaziencreme, small | €29 | 2 |
| Erdbeersahne, 12 slices | €44 | 2 |
| Sachertorte, 16 slices | €59 | 2 |

The menu does not state an effective date; confirm availability and final price with the bakery. Delivery and extra decorations are not included. The cake graphic is a decorative icon, not a photograph of a menu item.

First gift: [SV Elversberg Baby-Body “Neuzugang”](https://www.merchandising-onlineshop.com/sv07elversberg/baby-body-neuzugang-1907-7013.html). Its current price, sizes, and stock are left to the shop. No product photo or unverified price is invented.
