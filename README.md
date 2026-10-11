# OFFLINE DINO 🦖 — Style 1: Friendly Classic Edition

A colorful, smooth, and polished 2D cartoon endless runner inspired by the classic Chrome Dino game. Fully redesigned based on **Style 1 — Friendly Classic**: featuring a charming green dinosaur with closed-eye ducking, warm desert sandstone mesas, fluted flower cacti, pterodactyls, authentic Chrome Dino sound effects, and complete screen navigation (with Home & Exit buttons).

Built with pure HTML5, CSS3, procedural Vector Canvas graphics, and the Web Audio API — **100% offline with zero external dependencies**.

---

## 🎮 How to Launch & Play

### Local HTTP Server (Recommended)
The local server is already running in the project directory:
**[http://127.0.0.1:3000/](http://127.0.0.1:3000/)**

To start it manually at any time:
```bash
node server.js
```
Then open your browser to `http://127.0.0.1:3000/`.

### Direct File Open
You can also double-click `index.html` or drag it into any web browser (Chrome, Edge, Firefox, Safari).

---

## 🕹️ Controls

| Platform | Action | Control |
| :--- | :--- | :--- |
| **Desktop / Laptop** | **Jump** | `Spacebar` or `Up Arrow` (`↑`) or `W` |
| | **Duck** (Eyes Close) | `Down Arrow` (`↓`) or `S` |
| | **Fast Fall** | Hold `Down Arrow` (`↓`) while in mid-air |
| | **Pause / Resume** | `Escape` or `P` or click Pause button (`⏸`) |
| **Mobile / Tablet** | **Jump** | Tap anywhere on screen |
| | **Duck** (Eyes Close) | Swipe down & hold |
| | **Pause** | Tap Pause button (`⏸`) at top-right |

---

## ✨ Style 1: Friendly Classic Highlights

### 1. Redesigned Dinosaur Character
- **Friendly Cartoon Mascot:** Apple green body with darker green back spots, buttery cream underbelly & lower jaw, cute dorsal bumps, and an open smiling mouth with pink tongue.
- **Idle Animation:** Gentle breathing, occasional blinking (`^ ^`), and curious head tilt ("look around").
- **5-Frame Run Cycle:** Athletic stride with alternating legs, 3 rounded toes, pumping arms, and natural tail sway.
- **5-Phase Jump Sequence:** Take-off crouch, Ascending leap, Peak in-air soaring pose, Descending stretch, and Landing knee absorption.
- **Duck Animation with CLOSED EYES (Crucial Feature):**
  - Body flattens horizontally into a streamlined low crawl.
  - **Eyes gently close in a sweet happy arc (`︶ ︶`) with relaxed smiling mouth!**
  - Eyes reopen naturally as soon as ducking ends.
- **Collision / Game Over Pose:** Dinosaur lies flat on its belly on the ground with dizzy spiral/X eyes and yellow cartoon stars spinning overhead.

### 2. Redesigned Desert Environment & Day/Night Cycle
- **Daytime Desert Scene:**
  - Bright blue sky (`#4da6ff` to `#8cd0ff`) with soft fluffy white cartoon clouds.
  - **Background Sandstone Mesas & Canyon Formations:** Multi-layered desert mesas with flat tops and vertical cliffs that scroll with gentle parallax depth.
  - **Warm Desert Ground:** Golden sandy earth with scattered smooth pebbles and classic Chrome Dino terrain dashes.
- **Nighttime Desert Scene:**
  - Deep dark indigo sky (`#131a38` to `#1e2954`).
  - **Glowing Full Moon:** Soft craters and moonlight haze.
  - Silhouette canyon mesas in deep navy/purple.
  - Abrupt day/night transition every ~700–1000 points.

### 3. Redesigned Obstacles
- **Saguaro Cacti (Style 1 Panel 6):** Fluted cylindrical ribs, side arms, and a signature **cute orange/red flower/bud on the top center**. Single, double, and triple variations.
- **Flying Pterodactyls (Style 1 Panel 6):** Warm brown/tan cartoon pterosaur with cream underbelly, head crest, and animated flapping bat wings spawning at 3 heights (Low = Jump, Mid = Duck, High = Run under).

### 4. Audio Engine Overhaul (Authentic Chrome Dino Sounds)
- **Instant Unlocking:** Listens for `keydown`, `touchstart`, and `mousedown` across the entire window so audio starts immediately upon user interaction with zero delay.
- **Jump Blip:** Signature high crisp piezo blip (~900–980Hz) matching the original Chrome Dino jump feel.
- **Hit Crunch:** Descending 3-tone square-wave crash with snappy punch.
- **Score Milestone:** Signature two-tone chime (G5 at 784Hz -> C6 at 1046.5Hz) every 100 points.
- **Duck Swoosh & UI Pop:** Smooth aerodynamic sound and bubble tap.
- **Key Repeat Protection:** Debounced so holding Space or Up Arrow doesn't spam sounds or glitch jumps.
- **Full Mute/Unmute:** Persisted across sessions in `localStorage`.

### 5. Complete UI & Navigation
- **Home Screen:**
  - 1. OFFLINE DINO Title & Style 1 — Friendly Classic label.
  - 2. Single animated dinosaur mascot running in place directly above START GAME (zero ground surface, zero ground shadow).
  - 3. Bouncing cartoon **START GAME** button.
  - 4. Bottom toolbar: **High Score**, **Sound (Mute/Unmute toggle)**, and **Exit** (with browser-safe fallback dialog). Settings completely removed.
- **Pause Menu:** Includes **Resume**, **Restart**, and **Home** (abandoning run without recording as completed). Settings completely removed.
- **Game Over Screen:** Includes Run Score, Best Score, **Play Again**, and **Home**.
- **High Scores Screen:** Displays Best Score, Last Score, and Games Played.
- **Countdown:** Centered **3 → 2 → 1 → GO!** on game start, restarts, and tab-focus recovery.

---

## 📁 Project Structure

```
dino/
├── css/
│   └── style.css          # Modern cartoon CSS design system & responsive styling
├── js/
│   ├── audio.js           # Authentic Chrome Dino Web Audio synthesizer with auto-unlock
│   ├── sprites.js         # Style 1 Friendly Classic vector renderer (Dino, Mesas, Cacti, Pterodactyl)
│   ├── game.js            # Engine loop, 5-phase jump physics, spawner, and multi-box hitboxes
│   └── ui.js              # Screens, modals, countdowns, touch gestures, and navigation
├── icons/
│   ├── favicon.svg        # Style 1 Friendly Classic vector favicon
│   ├── icon-192.png       # PWA app icon (192x192)
│   └── icon-512.png       # PWA app icon (512x512)
├── index.html             # Semantic markup, HUD, modals, and canvas viewport
├── manifest.json          # PWA Web App Manifest
├── sw.js                  # Service Worker for 100% offline caching
├── server.js              # Lightweight zero-dependency Node HTTP server
└── README.md              # Full documentation and guide
```

---

## 🧪 Testing Checklist Verification

- [x] Friendly Classic dinosaur replaces previous model across all screens (Home, Gameplay, Pause, GameOver).
- [x] Idle animation has gentle breathing, blinking, and looking around.
- [x] 5-frame athletic running cycle is smooth and seamless.
- [x] 5-phase jumping sequence (Take-off, Ascending, In-air, Descending, Landing).
- [x] **Dinosaur closes its eyes while ducking**, and eyes reopen when ducking ends.
- [x] Collision pose shows dinosaur flat on ground with dizzy eyes and spinning stars.
- [x] Background features layered sandstone canyon mesas with subtle parallax.
- [x] Nighttime features deep indigo sky with a glowing cratered full moon.
- [x] Cacti have fluted cylindrical ribs with a red/orange flower on top.
- [x] Pterodactyls are warm brown/tan with flapping wings at 3 heights.
- [x] Jump sound blip plays immediately with zero delay.
- [x] Collision sound plays with crunch and low rumble.
- [x] Milestone two-tone chime sounds every 100 points.
- [x] Mute/Unmute silences and restores all sounds reliably.
- [x] Home screen features an **Exit** button.
- [x] Pause menu features a **Home** button.
- [x] Game Over screen features a **Home** button.
- [x] Statistics (Best, Last, Games Played) persist in `localStorage`.
- [x] 100% offline functional via Service Worker and local assets.
