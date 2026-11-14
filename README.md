# Open Plan

A 3D office-politics survival game where you navigate manipulation, set boundaries, and learn to protect your energy—all through voice conversations with AI-powered coworkers.

Built for a hackathon using the **Alebex Voice API**.

![Open Plan playthrough: a new hire tours the office and talks to six coworkers, saying yes to most favors, no to skipping tests, and taking the mentor's advice to set boundaries](docs/media/playthrough.gif)

You start your first day at a new job. Walk around the office, talk to coworkers, and decide which favors to accept. Some help your career. Others drain your energy. Make it to Friday's performance review without burning out.

In this playthrough, a beginner says yes to almost everything: gossip, a weekend sprint, team lunch, and a late night. Energy drops and burnout starts to climb. They turn down the advice to skip testing, and the mentor tells them to set boundaries.

[Watch the full-quality video (MP4, 76 s)](docs/media/playthrough.mp4)

## 🎮 The Game

You're a new hire on an open-plan office floor. Your goal: survive and get promoted without burning out. Walk freely, talk by voice to coworkers and the boss, accept or decline their offers, and manage your stats.

**Stats:** Energy, Reputation, Performance, and Burnout (0–100)  
**Win condition:** Reach promotion threshold (Performance 70+, Reputation 60+)  
**Lose condition:** Burnout hits 100

Some characters manipulate you, one gets jealous after promotion, some give confidently bad advice, and one is genuinely helpful. The game quietly teaches office-politics lessons: spotting manipulation, setting boundaries, managing up, and protecting your energy.

## 🎨 Look & Feel

Open Plan shares its look with [Interview Quest](https://interview-quest-theta.vercel.app): a hand-illustrated isometric world on a night-navy backdrop, with warm, slightly desaturated colours, soft ink outlines and cozy, detailed props. All of the art is original and procedural, built from Three.js primitives. There are no image assets apart from a few tiny canvas textures.

![The whole office floor in the painted isometric view](docs/media/restyle-overview.jpg)

- **Camera:** a fixed orthographic isometric view, 35° down and 45° round from the south-east. It follows the player, and you can zoom between 0.6× and 2.4×.
- **Shading:** stepped toon shading through a 4-step ramp. `paint()` in `src/palette.ts` maps every original colour into the shared palette: warmer, about 30% less saturated, greys warmed towards umber, and no pure white or black.
- **Ink and paper:** a post pass draws ink outlines from depth jumps, depth creases and colour edges, with a slight hand-drawn wobble. It also adds fine paper grain, a soft colour wash and Interview Quest's navy vignette.
- **Light:** late-afternoon sun comes in through the far (north and west) windows, with warm light pools on the floor and soft shadows falling towards the camera. Lamps and the fireplace add warm practical light. People and pickups have soft contact shadows.
- **Dollhouse cutaway:** the far outer walls stay full height and keep their windows and art. Every other wall is cut down to a low partition, and the ceiling, hanging lamps and signs are hidden, so every room reads from above. Rooms and areas get small labels on the floor, like Interview Quest's street names.
- **Props:** desks with monitors, mugs and paper stacks; plants; whiteboards; the copier; the lunch room with its fridge, vending machine and tables; a wall clock; the lounges and the fun zone.
- **Characters:** chunky, illustrated coworkers in distinct outfits. Their name tags use Interview Quest's NPC label style, and when you're close a tag grows to show the role and the talk key.
- **HUD:** Interview Quest's UI tokens and components: a top bar with brand and clock chips, dark translucent cards, teal-to-amber stat bars, amber gradient buttons, the bottom dialogue box for offers (with a portrait badge in the coworker's outfit colour), the result card for the Friday review, and matching toasts and conversation panel.
- **Accessibility and performance:** with `prefers-reduced-motion`, the camera and zoom snap instead of easing, idle bobbing and marker pulsing stop, and UI animations are turned off. The shadow map is drawn once, because furniture doesn't move. Render resolution is capped at 1.75×, and drops to 1× if frames run slow.

| Before | After |
| --- | --- |
| ![Before: third-person pastel view](docs/media/restyle-before.jpg) | ![After: painted isometric view](docs/media/restyle-after.jpg) |

![Walking the open office, talking to Marcus and accepting his offer, then zooming out](docs/media/restyle-gameplay.gif)

**Setting:** one enclosed office floor. An open-plan centre with desks and computers is surrounded by a lunch room, a copy room and a back row of rooms (meeting room, manager's office and the boss's corner office). There's also reception, a luxury lounge, a TV lounge, a fun zone, plants and windows.

**Controls:**
- WASD/Arrows: move along the screen (W/↑ is always up the screen in the iso view)
- E: talk to a nearby character or collect an item
- Mouse wheel, `+`/`-`, or the on-screen buttons: zoom
- Click a gold marker to sit or play; Space spins an office chair

## 📦 What's Included

- **3D game client** (Vite + Three.js + TypeScript)
- **Node server** (Express + WebSocket proxy)
- **Voice integration** via Alebex Voice API
- **Demo mode** (fully playable without API key)
- **Agent setup script** (idempotent, creates/updates agents)
- **Tests** (vitest: game engine, webhook signatures, prompt validation, iso camera and input mapping, palette, cutaway, HUD)

## 🚀 Quick Start

### Demo Mode (No API Key)

```bash
npm install
npm run dev
```

Open http://localhost:43123 in your browser. The game runs in demo mode with text dialogue and scripted offers.

### Voice Mode

1. **Get an Alebex API key:**
   - Sign up at https://app.alebex.ai
   - Create a voice API key in the developer console

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your ALEBEX_API_KEY
   ```

3. **Create agents:**
   ```bash
   npm run setup-agents
   ```
   This creates 6 voice agents (one per character) and saves their IDs to `agents-config.json`.

4. **Optional: Enable tools** (requires public HTTPS URL)
   
   Tools let agents check your game state and make offers during calls. You need a tunnel:

   **Option A: Tailscale Funnel** (recommended)
   ```bash
   # Install Tailscale, then:
   tailscale funnel 3456
   # Copy the HTTPS URL to .env as PUBLIC_BASE_URL
   ```

   **Option B: ngrok**
   ```bash
   ngrok http 3456
   # Copy the HTTPS URL to .env as PUBLIC_BASE_URL
   ```

   Then re-run `npm run setup-agents` to update agents with tool URLs.

5. **Run the game:**
   ```bash
   npm run dev
   ```

   The badge in the top-left shows "Voice Mode" when your API key is detected.

## 🎤 Run Locally with Voice

The simplest path to voice mode on your local machine:

```bash
# Clone the repository
git clone https://origin.cursor.com/git/bananaketchup/tmp-7769dad7229128c6.git
cd tmp-7769dad7229128c6

# Install dependencies
npm install

# Set your API key (get one from https://app.alebex.ai)
export ALEBEX_API_KEY=wt_your_key_here

# Create the voice agents
npm run setup-agents

# Start the server (serves on http://0.0.0.0:3456)
npm start
```

Then open **http://localhost:3456** in your browser (the microphone requires localhost or HTTPS). Walk around, press E near a character to talk by voice, and press E again during a call to hang up.

**Note:** This runs without tools (no PUBLIC_BASE_URL), so offers appear as keyword-detected cards rather than agent-initiated tool calls. The full experience with tools requires a public HTTPS URL (see Voice Mode setup above).

## 🏗️ Architecture

```mermaid
graph TB
    Browser[Browser Client<br/>Three.js + WebSocket]
    Server[Node Server<br/>Express + ws]
    Alebex[Alebex Voice Engine<br/>wss://api.voice.alebex.ai]
    Tools[Tool Endpoints<br/>/tools/*]
    Webhook[Webhook Endpoint<br/>/webhooks/alebex]

    Browser -->|WebSocket /ws/call| Server
    Server -->|Proxy with API key| Alebex
    Alebex -->|Audio + transcript| Server
    Server -->|Audio + transcript| Browser
    
    Alebex -->|Tool calls| Tools
    Tools -->|Game state / offers| Alebex
    
    Alebex -->|End-of-call report| Webhook
    Webhook -->|Store memory| Server

    Browser -->|Mic PCM16 16kHz| Server
    Server -->|Agent audio 24kHz| Browser
```

### Key Components

**Client (`src/`):**
- `game.ts` - Three.js scene, player movement, NPC rendering
- `game-engine.ts` - Stats, choices, time, inventory, promotion logic
- `voice-client.ts` - WebSocket to server, mic capture, audio playback (mark-echo rule)
- `characters.ts` - Character definitions and prompts (follows Alebex best practices)
- `items.ts` - Collectible items with stat effects

**Server (`server/`):**
- `index.ts` - Express app, serves client, WebSocket upgrade
- `voice-proxy.ts` - Proxies browser ↔ Alebex WebSocket, hides API key
- `tools.ts` - `/tools/check_player` and `/tools/make_offer` endpoints
- `webhook.ts` - `/webhooks/alebex` with HMAC-SHA256 signature verification

**Scripts (`scripts/`):**
- `setup-agents.ts` - Idempotent agent creation via Alebex API

## 🎭 The Cast

| Character | Role | Archetype | Description | Color |
|-----------|------|-----------|-------------|-------|
| **Marcus Chen** | Senior Product Manager | Flatterer | Lavish praise + endless "urgent" tasks. Means well, doesn't see the pile-on. | Pink |
| **Sarah Kim** | Team Lead | Jealous Peer | Warm until your promotion, then passive-aggressive. | Green |
| **Brad Thompson** | Engineering Manager | Overconfident | Confident terrible advice: skip testing, overcommit, work visible hours. | Blue |
| **Diana Foster** | VP of Operations | Burnout Boss | "We're a family" + unsustainable urgency. Everything is a "temporary emergency." | Purple |
| **James Rivera** | Staff Engineer | Honest Mentor | Actually helpful: boundaries, sustainable pace, respectful no. Easy to overlook. | Yellow |
| **Taylor Brooks** | Office Coordinator | Gossip | Knows everything, shares everything. Not malicious, just can't keep secrets. | Gold |

## 📋 Voice Integration Details

### How It Works

1. **Browser captures mic** (PCM16, 16 kHz, 20 ms frames = 640 bytes)
2. **Server proxies WebSocket** to `wss://api.voice.alebex.ai/public/ws/call`
   - API key sent as `Sec-WebSocket-Protocol: alebex.token.<key>` (never reaches browser)
3. **start_call frame** includes:
   - Agent ID for the character
   - Context: day/time, stats, level, promotion status, items, conversation memory
4. **Audio flows both ways:**
   - Outbound: PCM16 binary frames
   - Inbound: Base64 PCM16 JSON frames at 24 kHz
5. **Mark-echo rule:** Client holds each `mark` frame and echoes it only after audio finishes playing
6. **clear_audio:** Stop all playback immediately, echo held marks
7. **Tools** (when PUBLIC_BASE_URL is set):
   - `check_player` - Returns speakable game state
   - `make_offer` - Presents Accept/Decline choice card
8. **End-of-call webhook** verifies HMAC-SHA256 signature, stores conversation memory

### Prompts

All character prompts follow the Alebex best practices guide:
- No exclamation marks
- Contractions always (I'm, you're, don't)
- Numbers as spoken ("forty-five", not "45")
- Dates as spoken ("Friday, December fifth")
- Money in full words ("twenty-seven dollars and ninety-nine cents")
- Phone numbers digit by digit with pauses
- No markdown, lists, emoji, or symbols
- Short turns (1-2 sentences), then stop
- Honest if asked whether it's an AI

See `src/characters.ts` for full prompts.

## 🧪 Tests

```bash
npm test
```

Covers:
- ✅ Stat clamping (0-100)
- ✅ Burnout game-over trigger
- ✅ Choice acceptance (immediate + delayed effects)
- ✅ Time progression and overtime penalties
- ✅ Promotion thresholds
- ✅ Inventory collection
- ✅ Character memory (last 5 interactions)
- ✅ Webhook signature verification (HMAC-SHA256, constant-time compare, timestamp freshness)
- ✅ Prompt validation (no exclamation marks, placeholders, em/en dashes, reserved names)
- ✅ Isometric camera: 35°/45° offset, orthographic frustum, zoom clamping, reduced-motion snapping
- ✅ Screen-aligned WASD/arrow mapping (W is always up the screen, diagonals normalised)
- ✅ Painterly palette mapping, and UI tokens kept in sync with the stylesheet
- ✅ Dollhouse cutaway (which walls stay, get cut, or hide)
- ✅ HUD markup hooks, stat tones, name tags and area labels

## 🔒 Security

- API key never reaches the browser (server-side proxy)
- Webhook signatures verified with HMAC-SHA256, constant-time comparison, 5-minute timestamp window
- Tool endpoints require shared secret (if TOOL_SHARED_SECRET is set)
- Secrets never logged

## 📝 Environment Variables

```bash
# Required for voice mode
ALEBEX_API_KEY=wt_your_api_key_here

# Optional (use defaults if not set)
ALEBEX_API_URL=https://api.alebex.ai/api/v1
ALEBEX_ENGINE_URL=https://api.voice.alebex.ai

# Required for tools (public HTTPS URL)
PUBLIC_BASE_URL=https://your-tunnel.ngrok.io

# Required for webhooks
ALEBEX_WEBHOOK_SECRET=whsec_your_webhook_secret
TOOL_SHARED_SECRET=your_tool_secret_here

# Server port
PORT=3456
```

## 🎯 Design Lessons Embedded

The game teaches:
1. **Spotting manipulation** (flatterer, burnout boss)
2. **Setting boundaries** (declining without guilt)
3. **Managing up** (choosing when to say yes)
4. **Protecting energy** (overtime costs burnout)
5. **Impact over hours** (performance ≠ long hours)
6. **Recognizing good advice** (mentor is easy to overlook)
7. **Reading office dynamics** (jealousy after success, gossip consequences)

## 🛠️ Tech Stack

- **Client:** TypeScript, Vite, Three.js
- **Server:** Node, Express, ws (WebSocket)
- **Voice:** Alebex Voice API
- **Tests:** vitest
- **Build:** TypeScript compiler + Vite

## 📦 Production Build

```bash
npm run build
npm start
```

Builds client to `dist/client`, server to `dist/server`.

## 🐛 Troubleshooting

**"Voice Mode not available"**
- Check `ALEBEX_API_KEY` in `.env`
- Restart dev server after adding key

**"No audio in call"**
- Allow microphone access in browser
- Check browser console for errors
- Ensure you're on a secure origin (localhost or HTTPS)

**"Tools not working"**
- Set `PUBLIC_BASE_URL` to a public HTTPS URL
- Run `npm run setup-agents` again after setting it
- Check server logs for tool endpoint errors

**"Webhook signature fails"**
- Verify `ALEBEX_WEBHOOK_SECRET` matches your webhook config
- Check server clock is accurate (signature includes timestamp)

## 📄 License

MIT

## 🙏 Acknowledgments

- Inspired by the visual style of *Big Walk* by House House
- Built with the Alebex Voice API
- Created for a hackathon
