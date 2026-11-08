# Drum Warm-Up · 三種打點練習

A metronome-driven drum warm-up web app, tuned for iPad (Air gen 4, landscape).
Transcribed from the *Three Practice Types* (三種打點練習) sheet by JDAC.

## Features

- **Four practice parts** you step through:
  1. **Singles Switch** 手順類 — 7 lines, split across two pages (1–4 / 5–7)
  2. **G3 Hand Switch 1211** 句型①
  3. **G3 Hand Switch 21211** 句型②
  4. **Hand Coordination Switch** 雙手協調類 (65 → 85 BPM)
- **Real drum notation** rendered in-app (staff, beamed sixteenths, accents), with the current note highlighted in sync.
- **Metronome** (Web Audio): tempo presets 65 / 85 / 100 BPM plus fine tune, and a
  click subdivision selector — **4分** (the 4/4 pulse), **8分**, or **16分**.
- **Two practice modes** for parts 01/02/03:
  - **循環 (Loop)** — repeat the current line/bar until you tap 下一個.
  - **每個 ×3** — play each line/bar three times, then auto-advance.
- Count-in, auto-advance between parts, keeps the screen awake, fullscreen, and
  installable as a home-screen app (PWA, works offline).

## Run it

It's a static site — no build step.

```bash
python3 -m http.server 8777
```

Then open `http://<your-computer-ip>:8777` on the iPad (same Wi-Fi) and
**Share → Add to Home Screen** for a fullscreen app.

### GitHub Pages

Push this folder to a repo, then in **Settings → Pages** choose the `main`
branch / root. The app will be served at `https://<user>.github.io/<repo>/`.

## Editing the exercises

All patterns live in `exercises.js`. Each line has a `sticking` string (16 chars,
`R`/`L`) and a matching `hl` string (`.` normal, `A` = blue highlight/accent).
Edit a character and the notation updates — no build needed.

## Keyboard shortcuts

`Space` play/pause · `N` next line/bar · `←/→` prev/next part · `↑/↓` tempo ±1
