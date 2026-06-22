# I Ching — Shake to Cast

A minimal, ink-and-paper PWA for consulting the *I Ching* (Book of Changes). Shake
your phone to cast the lines — a physical proxy for the traditional coin/yarrow ritual.

## Features

- **Shake to cast** via the `DeviceMotion` API. Tap "…or tap here to cast" (or press
  Space on desktop) as a fallback.
- **Two modes**
  - **Ritual** — shake 6 times, one line each, built bottom-to-top like the real rite.
  - **Quick** — one shake casts the whole hexagram in a cascade.
- **Yarrow-stalk probabilities** — the authentic skewed odds per line (out of 16):
  old-yin 1, young-yin 7, young-yang 5, old-yang 3. (Moving yang is rarer than moving
  yin, exactly as the stalk method gives — unlike the even-ish three-coin method.)
- **Changing lines → transformed hexagram.** Moving lines are marked in cinnabar; the
  app shows the present hexagram and the one it is changing into.
- **Both texts** for every hexagram: a concise modern gloss plus the classical
  **Legge** translation (Judgment + Image) and the trigram structure.
- **Question field** — hold your question in mind; it's shown atop the reading. Nothing
  is persisted (no history, no storage).
- **Installable PWA**, works offline (service worker), Android-first.

## Run locally

ES modules require HTTP (not `file://`). Any static server works:

```bash
npx serve .        # or: python -m http.server 8000
```

Then open the served URL. On a phone, "Add to Home Screen" to install.

## Deploy to GitHub Pages

It's a static site — push these files to a repo and enable Pages (serve from root or
`/docs`). No build step. `DeviceMotion` works on Android Chrome over HTTPS without a
permission prompt; iOS Safari shows an "Enable shake detection" button (it requires a
user gesture to grant motion access).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup: cast screen + reading screen |
| `style.css` | Ink-and-paper theme, hexagram line rendering, animations |
| `data.js` | All 64 hexagrams (trigrams, Legge Judgment/Image, modern gloss) + King Wen lookup |
| `iching.js` | Casting engine: yarrow probabilities, changing lines, transformation |
| `app.js` | UI controller, shake detection, mode handling, rendering |
| `sw.js` / `manifest.webmanifest` | PWA offline + install |

## Notes on the text

The classical passages are excerpts of James Legge's public-domain translation
(Judgment and Image for each hexagram). The modern glosses are concise plain-English
summaries. Per-moving-line commentary (Legge's reading for each individual changing
line) is **not** included in this version — the app instead shows the full present →
transformed hexagram pair, which is the most common way to read a multi-line cast.
