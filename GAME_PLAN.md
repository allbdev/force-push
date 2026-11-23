# Force Push — Game Plan

> Your bomb is a `git push --force`. The blast paints the floor in your branch's colour. Whoever owns the most of the codebase when the sprint ends wins.
> A free, open-source, 3D browser game for 2 to 4 players, played from a link. A portfolio piece: the code is part of the product.

**Author:** Vinícius Albuquerque Barros · **Written:** 22 Nov 2026 · **Status:** plan and mockups only, nothing built

The original one-page pitch is `FORCE_PUSH.md`. Mockups live on the design canvas "Force Push — Mockups" (https://claude.ai/artifact/CvekFxFmsvEAGt3Rfwiu6H) and as JPG exports in `designs/`. The canvas and this file are kept in sync both ways (see `CLAUDE.md`). All names, numbers and lines are first drafts. Effort figures are estimates, not measurements.

---

## 1. Pitch

A turf war in an open-plan office. Four branches, one floor, three minutes. Blasts paint tiles; nobody is eliminated; the result is a diff.

## 2. Decisions so far

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Concept | Grid arena with timed blasts, seen from above. **Score is territory, not kills**; nobody is eliminated | A losing player can repaint the map in the last 20 seconds, and nobody sits out |
| D2 | Platform | Browser, played from a link, desktop and phone. **Needs a small server** (the first of the sibling games that does) | Online rooms are the point; no store, no login |
| D3 | Stack | TypeScript strict, Vite, three.js, Vitest + fast-check, Playwright, GitHub Actions | Scaffold from `../park-the-cart`; three.js is named in the pitch (§12) |
| D4 | Simulation | A pure, deterministic `step(state, inputs) → state` at **20 ticks per second**, **integers only** | The server and the client run the same code; replays are an input log; no floats means no cross-browser drift |
| D5 | Networking | One authoritative room per match over WebSocket. Clients send inputs, predict their own movement and reconcile with the server's ticks (§11) | Server authority stops cheating; prediction hides 100–150 ms |
| D6 | Room host | A plain WebSocket room running our own `step`, not Colyseus (Colyseus brings its own state sync, which we don't need). **Cloudflare** (decided 22 Nov 2026): one Worker serves the built client as static assets and runs one **Durable Object per room**, on `force-push.vinicius-albuquerque.com.br` | One object per room is exactly the model; client and socket share an origin; no server to keep alive. The room stays a class with a transport, so the host is still swappable |
| D7 | Bots | From the first version, written against the same `step`; empty seats become bots | Empty lobbies are the biggest risk; a match can start with one human |
| D8 | Text | **English by default, PT-BR toggle** | Same as the sibling games |
| D9 | Session | Sprints of 3 minutes (2 and 5 in the lobby); a room plays several in a row | It is opened from a link |
| D10 | Money | None. No ads, no accounts. The server keeps a room only while it is open; nothing is stored about players | Keeps it outside any compliance work |
| D11 | Look | A desk-toy office diorama with a code editor laid over it (§10) | Different from the other games |
| D12 | Art | Built by code: every model is a box with a bevel (racks, cartons, people), generated at load | It matches the look and costs no download |
| D13 | Repo | Public, MIT | The README is what a recruiter reads |
| D14 | Copy | Player-facing text never names another game | The pitch uses a familiar comparison; the game doesn't |
| D15 | Domain | `force-push.vinicius-albuquerque.com.br` (decided 22 Nov 2026) | Same pattern as Park the Cart |
| D16 | Power-up names | "Stack Overflow" stays as a nod (decided 22 Nov 2026) | Every developer gets the joke |

Open decisions are in `TODO_FOR_YOU.md`.

## 3. The loop

1. Open a link or type a room code. 2 to 4 players, each a branch: `main`, `feature`, `hotfix`, `dev`. Empty seats are bots.
2. Walk the grid and drop a force-push. Three seconds later it blasts in a cross and paints every tile it reaches in your colour.
3. Blasts break legacy boxes (which may hide a power-up) and stop at server racks.
4. Caught in a blast: you are **reverted**. You lose 4 seconds and 3 tiles near where you fell, and respawn at your desk. Nobody is eliminated.
5. When the sprint timer hits zero, the tiles are counted. The result is a pull request: `main won`, a diff per branch (`+212 −181`), and a share line.
6. Rematch, change map, or share.

**Score:** tiles owned at the end. Ties: the bigger `+` wins; still tied, they share the win.

## 4. Scope

**First version**
- One map (Open Space, 13 × 11), 2 to 4 players, room codes and links, bots in empty seats.
- Three power-ups: coffee, rubber duck, Stack Overflow.
- Reverts, respawn, territory HUD, commit log.
- Result as a diff, share line, rematch.
- Keyboard and touch; phone portrait with a camera that follows you.

**Second version (from the mockups)**
- Two more maps: Data Center and Rooftop Happy Hour (wind) (board 8).
- The other power-ups: second monitor and rebase.
- Code freeze in the last 30 seconds (board 6).
- Replays from the input log, and the end-of-match highlight with the close camera (board 4).
- Spectators; the daily map, the same for everyone, changes at midnight (board 8).

**Later**
- A ranked or seasonal mode.
- Custom maps from JSON.
- Share as an image.

## 5. Controls

| Keyboard | Touch (portrait) | Action |
|---|---|---|
| **WASD** / **Arrows** | Stick on the left (four directions) | Walk |
| **Space** | **push -f** button on the right | Drop a force-push |
| **Esc** | Pause button | Menu (the match keeps running: it's online) |

- Movement is **tile to tile**. Holding a direction keeps walking. At each tile centre the player takes the most recently pressed direction that is open; if that one is blocked, the other held one; else they stop. This makes corners forgiving without any free movement.
- A force-push goes on the tile you are standing on (the one you are closer to, mid-step). You can walk off a force-push but not onto one.
- Inputs are sampled once per tick: four direction bits and one push bit. That is all a client ever sends.
- The stick is quantised to four directions with a dead zone; targets at least 48 px.
- Remappable keys are not in the first version.

## 6. The rules

All numbers are first drafts, in ticks (20 per second) in the code.

### 6.1 The grid

- **Open Space:** 13 × 11 tiles inside the walls. Server racks stand on every other tile (x and y both odd: 30 racks), leaving 113 floor tiles. Legacy boxes ("LEGACY · NÃO MEXER") cover about 60% of the free floor, drawn from the match seed, except the tiles within two steps of each desk (so the first push has a safe corner to hide behind): 56 boxes, 17 of them hiding a power-up.
- **Desks:** one per branch, in the four corners. You start and respawn there.
- **Racks** never break and stop blasts. **Boxes** break when a blast reaches them; 30% hide a power-up (seeded).

### 6.2 Force-push

| | Value |
|---|---|
| Fuse | 3 s (60 ticks) |
| Range at start | 2 tiles each way |
| Carried at start | 2 at a time (the HUD shows `2 / 2`) |
| Blast lasts | 0.5 s (10 ticks): anyone who enters a blast tile is reverted |

- The blast goes out in a cross. Each arm stops before a rack, or on the first box it hits (the box breaks, its tile is painted).
- A blast that reaches another force-push sets it off on the next tick (chains).
- **Every floor tile the blast reaches becomes the owner's colour**, including tiles under players.
- Blasts pass over power-ups on the floor without destroying them.

### 6.3 Reverted

- Caught by a blast (yours included): "**You were reverted**". You are out for 4 s (80 ticks): a one-second fall, then a 3-2-1 count (board 5).
- **The 3 of your tiles nearest the spot** turn to the colour of the branch that reverted you (grey if you reverted yourself).
- You respawn at your desk with 1 s of grace (blinking: blasts pass through you).
- A rubber duck absorbs one blast instead.
- Pushes you placed before falling still go off.

### 6.4 Power-ups

Sit on a white plate with a coloured ring so they read on painted floor (board "Items and blocks").

| Power-up | Effect | Version |
|---|---|---|
| Coffee | Faster walking for 10 s (one tile per 4 ticks instead of 5) | First |
| Rubber duck | Survives one blast; shown on the player | First |
| Stack Overflow | +1 range for the rest of the sprint (max 6) | First |
| Second monitor | +1 force-push carried (max 4) | Second |
| Rebase | Your next blast also repaints tiles through one rack | Second |

### 6.5 Scoring: the diff

- **`+`** counts tiles your blasts turned to your colour (repainting your own tile doesn't count). **`−`** counts tiles of yours that turned to someone else's colour (or froze).
- So **`+` minus `−` is exactly the tiles you own at the end**. A test holds the core to it.
- The HUD and the result show each branch's share **of the painted tiles** (grey tiles count for nobody), so the four shares add up to 100%.
- Example (board 7): `main +212 −181` (31 tiles, 31%), `dev +190 −163` (27%), `hotfix +171 −148` (23%), `feature +140 −121` (19%).

### 6.6 Code freeze (second version)

In the last 30 s the outer ring closes tile by tile, clockwise from the north-west corner, one tile every ~0.75 s. A closed tile is a wall and counts for nobody (`−` for its owner). Standing on a tile as it closes reverts you; respawn moves to the nearest open floor tile to your desk. The timer turns red and reads "code freeze in" (board 6).

### 6.7 Bots

- They run on the same `step`, from the room's seed, so a bot plays the same on the server and in a replay.
- Each tick a bot reads a **danger map** (tiles a pending blast will reach, and when), then picks a goal by score: boxes in reach, tiles that aren't its colour, power-ups, escape. It drops a push only if it can reach a safe tile before the fuse ends.
- One difficulty in the first version. A bot plays as `bot` in the lobby ("joins if nobody comes").

## 7. Rooms

- **Code:** three letters and four digits, `FRI-1758`, from an alphabet without look-alikes (no I/O/0/1 in the letters). The link is the game URL with `?room=FRI-1758`.
- **Lobby** (board 2): the four seats with the branch, name and state ("ready", "choosing headphones…", "joins if nobody comes"), the map, the sprint length (2 / 3 / 5 min), **Start sprint** (the room's creator), **Leave**. A mock terminal reads the room's status (`3 of 4 ready. Waiting for Rafa.`).
- **Seats:** the first four to join get `main`, `feature`, `hotfix`, `dev` in that order. A room can start with one human; empty seats become bots.
- **Names:** optional, up to 12 characters, letters, digits, space, `_` and `-` (any script), checked on the server. Shown to the other players only; nothing is kept after the room closes.
- **Drop out mid-sprint:** a bot takes your seat until you come back with the same link.
- **Rematch:** the same room, a new seed. The room closes 5 minutes after the last player leaves.

## 8. Maps

Maps are JSON in `src/content/maps/`, validated when loaded: size, racks, desks, box density and the rules each map adds.

| # | Name (EN) | PT-BR | What's different | Version |
|---|---|---|---|---|
| 1 | Open Space | Open Space | The default. Racks in a grid, legacy boxes in the way | First |
| 2 | Data Center | Data Center | More racks, narrow aisles. One good push paints half the map | Second |
| 3 | Rooftop Happy Hour | Happy Hour no Terraço | Late afternoon. Wind pushes each force-push one tile, one second after it's dropped, if the tile is free | Second |

**The daily map** (second version): drawn from the date (the player's local midnight) from the same pieces; the same for everyone. Bots must finish a match on it without getting stuck, or the generator re-rolls.

```jsonc
{
  "id": "open-space",
  "size": [13, 11],                     // tiles inside the walls; x right, y down
  "racks": "grid",                      // or an explicit list of [x, y]
  "desks": { "main": [0, 0], "feature": [12, 0], "hotfix": [0, 10], "dev": [12, 10] },
  "boxes": { "density": 0.6, "clear": 2 },  // no boxes within 2 steps of a desk
  "drops": { "rate": 0.3, "weights": { "coffee": 4, "duck": 2, "stackOverflow": 4 } },
  "wind": null                          // rooftop: { "dir": "east", "delay": 20 }
}
```

The validator is hand-written (no schema library without asking) and rejects a desk inside a rack, a desk that can't reach the others, and unknown keys.

## 9. HUD, result and sharing

- **Match HUD** (board 3): "sprint ends in" and the time; the territory bar with each branch tag and its share; the room code; a name tag over each player (`main · you`); "push -f in 2s" over each pending push; "+9 tiles → dev" where a blast lands; power-up labels on the floor ("coffee · speed"); the **commit log** at the bottom left (`a3f9c1 dev force-push +9 −5`, `77be02 feature got coffee`, `c41d9e hotfix reverted by main`); your pushes and range at the bottom right with the control hint.
- **Reverted** (board 5): the arena desaturated, `$ git revert main`, "You were reverted", who did it, the countdown, and "Nobody is eliminated. You lose 4 seconds and 3 tiles near where you fell."
- **Result** (board 7): "Pull request #1758 · merged", "**main won** the sprint", one row per branch (tag, name, `+` and `−`, share), **Rematch**, **Change map**, **Share**, and highlights: biggest push, most reverted, legacy destroyed ("Nobody will miss it.").
- **Share line** (draft):
  `Force Push · room FRI-1758` / `main won: +212 −181 (31%)` / `42 force-pushes · 2 reverts` / `force-push.vinicius-albuquerque.com.br`. PT-BR: `Force Push · sala FRI-1758` / `main venceu: +212 −181 (31%)`. Line 2 is the winner; line 3 is the sharer's own match.
- **Highlight replay** (second version, board 4): after the result, the biggest push again with the camera down close ("force-push", `$ git push --force origin dev`, the tiles gained and lost). During play the camera never moves in.
- **Replays** (second version): the match is its seed, map, version and input log, so a replay is a file or a link that runs `step` again. Untrusted input: length cap, strict parse, polite failure.

## 10. Look

A desk-toy office seen from above, with a code editor laid over it. (Canvas page "Art direction".)

- **Bright daylight, crisp shadows, saturated floor:** the score is the floor, so the floor is the loudest thing on screen. Carpet tiles, glass walls, desks around the arena.
- **Everything is a box with a 3 cm bevel:** racks, cartons, people. Toy-like, not round.
- **The characters** (board "The branches") are blocky toy developers in hoodies; the hoodie is the branch colour, so a player reads from above at any size. `main`: glasses, thinks their branch is the truth. `feature`: red headphones, always "almost done". `hotfix`: laptop in hand, arrives, fixes, breaks something else. `dev`: cap and beard, nobody knows what's in there. The same kit is used in Deploy na Sexta.
- **The interface is an editor:** dark panels, monospace, diff green for gains and red for losses, always with `+` and `−`. Git words are the verbs: push, revert, merge, freeze.
- **Camera:** fixed three-quarter view of the whole map on wide screens. Phones (portrait): it follows you. It moves in close only in the highlight replay.
- Against the other games: Dig to Japan is round cartoon, Um Buraco Só a photo, Cartório paper, Park the Cart a flyer. This one is a toy diorama plus a terminal.
- Colour never carries meaning alone: every tag carries the branch name, and every diff has its sign.
- **Floor patterns.** The colour-blind check (`npm run colours`, roadmap task 9) found hotfix and dev too close under deuteranopia (ΔE00 8.6, with grey near both), so each branch's painted tiles also carry a pattern (canvas page "Floor patterns").

**Tokens**

| Token | Value | Use |
|---|---|---|
| ground | `#14151b` | Screen background, dark buttons |
| deep | `#0b0c10` | Board and page backgrounds behind panels |
| panel | `rgba(20,21,27,0.93)` | HUD panels, cards |
| line | `#30333f` | Panel borders |
| line-strong | `#5a5f70` | Secondary button borders |
| text | `#e6e8ee` | Text |
| muted | `#aab0bf` | Labels |
| add | `#3fb950` | `+` diff, primary buttons (text on it `#08130b`) |
| remove | `#ff7b72` | `−` diff, Leave, code freeze |
| main | `#3f8cff` | Branch |
| feature | `#ff9a1f` | Branch |
| hotfix | `#ff4f93` | Branch |
| dev | `#19c3a6` | Branch (text on any branch colour `#0d0e12`) |
| floor | `#8c919c` | An unpainted floor tile (nobody's) |

| Font | Use |
|---|---|
| Space Grotesk | Titles and interface |
| JetBrains Mono | Labels, numbers, tags, the commit log, the share line |

Both are OFL and self-hosted in the build (no runtime calls to Google Fonts).

**Art.** Built by code (D12). The models are meshes generated at load: racks with blinking LEDs, cardboard boxes with tape and the "LEGACY" stamp, desks and monitors around the arena, the four developers with their accessories, the power-ups on their plates. Floor tiles are instanced, and a painted tile glows a little in its colour. One sun with a shadow map.

**Phones.** Portrait (board "Phone layouts"): the HUD is one strip (time, your share, the territory bar), the camera follows you instead of showing the whole map, the stick on the left and **push -f** on the right. The lobby and the result stack. Park the Cart found that upright play can feel cramped on a real phone; the phone check in `TODO_FOR_YOU.md` decides whether landscape is needed too.

**Screens on the canvas:** 1 Landing · 2 Lobby · 3 Match · 4 Force-push (replay) · 5 Reverted · 6 Code freeze · 7 Result: the diff · 8 Map select · Phone layouts · The branches · Items and blocks · Art direction.

## 11. Architecture

- **Pure simulation core.** `src/core` holds the grid, movement, force-pushes, blasts, painting, power-ups, reverts, scoring, bots and the protocol codec: no DOM, no network, no globals, no `Math.random()`, no clock.
- **Integers only.** Positions are a tile plus a step counter, timers are ticks, scores are tile counts. With no floats in the state, determinism across browsers and Node is free; a test checks it anyway.
- **Seeded RNG** (small, fast) for boxes, drops and bots, from the match seed.
- **The room** (`src/core/room.ts`) owns a match: seats, the tick, inputs, `step`. It knows nothing of sockets: a transport feeds it. In the first slice the room runs in the browser (local transport, bots only); later the same class runs on the server.
- **Netcode:**
  - Clients send `{seq, input}` (five bits). The server stamps each input to the tick it arrives on, so a client can't send inputs "from the future".
  - Every tick the server runs `step` and broadcasts that tick's inputs for all players. Every second it also sends a state hash; on a mismatch, or when joining, a full snapshot.
  - The client keeps the last confirmed state, runs ahead with its own inputs applied at once (prediction), and when the server's inputs for a tick arrive it rolls back and re-runs. The state is a few hundred bytes of integers, so re-running a handful of ticks is cheap.
  - Other players are drawn from the confirmed state, interpolated, so they never jump.
  - The three-second fuse and tile movement tolerate 100–150 ms; the HUD shows ping.
- **The server** only relays and validates: message size and rate caps, inputs that are five bits, names that pass the rule in §7, room codes that can't be guessed by scanning (rate-limited joins). It stores nothing.
- **Rendering** is three.js for the arena (instanced tiles, one directional light with shadows, models built by code); the HUD, lobby, result and menus are DOM (real `<button>`s, readable text, focusable).

## 12. Stack and conventions

Shared with `../park-the-cart`: one scaffold (Vite + TS + tests + CI + deploy), reused. Shared with Deploy na Sexta: the developer character kit and the room/lobby code.

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript, strict, client and server | One language; the server imports `src/core` |
| Build | Vite | Fast, static output |
| Rendering | three.js for the arena; DOM for HUD and menus | Instancing and shadows without writing a renderer; the pitch picked it |
| Server | A plain WebSocket room in a Cloudflare Durable Object (D6) | Same `step` as the client; swappable host |
| Tests | Vitest, fast-check (property tests), Playwright (smoke, two-client match) | Logic separate from drawing and from the network, and tested |
| CI | GitHub Actions: lint, typecheck, test, build, deploy (Wrangler) | Shows the pipeline |
| Hosting | Cloudflare: one Worker with the client as static assets and the rooms as Durable Objects (D6), on the domain in D15 | No store, no review queue; one deploy, one origin |
| Repo | Public, MIT, the README explains the netcode with a diagram | The README is what a recruiter reads |
| Text | English default, PT-BR toggle | D8 |
| Money | None | D10 |

## 13. What it shows

- A deterministic simulation shared by client and server.
- Client-side prediction and reconciliation, explained in the README with a diagram.
- Property tests: for random input streams and random latency, client and server end in the same state.
- Bots written against the same `step`.
- A 3D scene built entirely from code.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Empty lobbies | Bots from the first version; a match starts with one human |
| Lag on a twitchy game | Three-second fuse, tile movement, prediction with rollback; ping on the HUD; a lag simulator (`?lag=150`) in tests |
| "Just another clone of a famous arena game" | Territory scoring, no elimination, the diff result; no other game named in the copy |
| Server costs or limits | A tiny protocol (five bits per input), rooms close when empty; check the Cloudflare free-tier limits for Workers and Durable Objects (`TODO_FOR_YOU.md`) |
| The name is taken | Renamed from Merge Conflict (a jam game uses it) on 22 Nov 2026; Force Push is checked before launch (`TODO_FOR_YOU.md`) |
| Abuse through names | Short names, a strict character rule, never `innerHTML`; names never leave the room |
| Bundle size with three.js | Import only what's used; budget in `CLAUDE.md` checked in CI |

**Effort (estimate):** 3 to 4 weekends for the first version. The scaffold comes from Park the Cart.

## 15. What already exists

A quick search on 22 Nov 2026, not exhaustive. See `FORCE_PUSH.md` for sources.

- Open-source browser clones of grid-bomb arena games are common, including one with Babylon.js and Colyseus.
- Git-themed games exist but are different games: *Merge Conflict* (a Global Game Jam local co-op puzzle on itch.io) and *GitWars* (a two-player local jam game).
- I did not find a grid-arena game with territory scoring and a git theme.
