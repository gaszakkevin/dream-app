# What Should I Dream About?

Mobile-first PWA. Tap the moon to roll "Tonight, dream about [character], [place], [quest]" from
20 characters x 24 places x 24 quests (11,520 dreams). No build step and no dependencies.

## Run it

    node server.js        # or: npm start
    open http://localhost:5173

On a phone on the same Wi-Fi, open http://<your-computer-ip>:5173. Installing to the home screen
and offline use need HTTPS, so use the hosted copy for that.

## Hosting (Cloudflare Pages)

Connect this repo in Cloudflare Pages with framework preset **None**, build command **empty**, and
output directory **/** . Every push to `main` redeploys. `_headers` keeps `sw.js` and the grammar
uncached so content edits reach installed phones.

    node test.js          # grammar and engine checks

## Files

| File | What it is |
|---|---|
| `data/grammar.json` | All content: template, lead-ins, characters (realms + 4-colour palette), places (with realm), quests, bias default |
| `engine.js` | Pure roll logic (no DOM), shared by the app and the tests |
| `app.js` | UI: painting, shelf, share, bias slider, starfield |
| `styles.css`, `index.html` | Layout and look, ported from the demo |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA install and offline cache |

## Editing the grammar

Add or change entries in `data/grammar.json`, run `node test.js`, and bump `VERSION` in `sw.js`
so installed copies pick it up. Every character realm must have at least one place, or the test fails.

## The Kindred bias

Kindred mode forces a realm-matched place with probability `bias`; otherwise the place is random
(and about 26% of random places match anyway). Measured realm-matched share of dreams:

| Setting | Realm-matched |
|---|---|
| Anything goes | ~26% |
| Kindred @ 0.6 (default, production sheet) | ~70% |
| Kindred @ 0.8 (old demo setting) | ~85% |

Precedence: `?bias=0.6` in the URL, then the device's Kindred pull slider, then `bias.default` in the grammar.

## Sharing

Share uses the phone's share sheet, or copies the dream plus a link on desktop. Links look like
`/?d=DRM-005.0.12` (character id, place index, quest index) and open on that exact dream.
Reordering `places` or `quests` changes what old links point to, so append new entries instead.
