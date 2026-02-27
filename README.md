# My Snowboard 🏂

A browser-based snowboarding game where you name your rider, choose outfits, pick tricks, and try to survive the mountain.

**[Play it live](https://my-snowboard.vercel.app/)**

## How to Play

1. **Intro** — Name your snowboarder, choose a color, and select Solo or 2 Player mode
2. **Top of the Hill** — Pick a hill difficulty, check the weather, and choose a trick
3. **The Jump** — Hold to charge your launch power, then tap to time your landing
4. **The Chalet** — Spend coins on food to restore health, buy permanent gear upgrades, or head straight back to the hill
5. **Leaderboard** — Your best runs are saved locally so you can compete with friends

Game over when your health hits zero. Go for the highest coin total!

## Features

- Interactive jump controls with charge-and-release power meter and landing timing bar
- Dynamic weather system (Sunny, Clear, Snowfall, Blizzard) affecting visuals and gameplay
- Three hill difficulties: Bunny Hill, Black Diamond, Double Black
- Gear shop with permanent equipment upgrades
- Trick combo streaks with coin multipliers
- Two-player turn-based mode
- Local leaderboard (top 10 runs)
- Sound effects with on/off toggle
- Works on phones, tablets, and desktops

## How This Was Built

The primary developer on this project is a 9-year-old boy who is learning both snowboarding and software development at the same time. He designed the game mechanics, directed the features, tested on his phone, and provided the user research feedback that shaped every iteration. The game was built with the help of AI coding tools in Cursor.

### Tech Stack

- **HTML** — Single `index.html` with all game screens
- **CSS** — Vanilla CSS for styling, animations, and responsive layout
- **JavaScript** — Vanilla JS for all game logic, state management, and canvas rendering
- **Canvas 2D API** — Jump animation with dynamic weather, snowboarder physics, and mountain scenery
- **Web Audio API** — Synthesized sound effects (no audio files)
- **localStorage** — Leaderboard persistence

No frameworks, no build step, no dependencies. Just open `index.html` in a browser and play.

## Run Locally

Open `index.html` in any modern browser, or start a local server:

```bash
npx serve
```

## Deploy

Push to GitHub and connect to [Vercel](https://vercel.com) for instant static hosting.
