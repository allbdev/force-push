# CLAUDE.md — Force Push

Online browser game in **TypeScript (strict) + Vite**, drawn in 3D with three.js, with a small WebSocket room server that runs the same simulation as the client. Sibling of `../park-the-cart` (same scaffold and habits: data-driven content, logic separate from views, tests for everything) and of Deploy na Sexta (shares the character kit and the room/lobby code). Design: `GAME_PLAN.md`. Ordered task list: `ROADMAP.md`. Things only the developer can do: `TODO_FOR_YOU.md`. Original pitch: `FORCE_PUSH.md`. Art references: the design canvas and `/designs`.

Repo: https://github.com/allbdev/force-push (public, MIT). Live at https://force-push.vinicius-albuquerque.com.br. Hosting: Cloudflare (one Worker serves the client as static assets and runs a Durable Object per room; `GAME_PLAN.md` D6).

## Security audit before every push (strict)

- **Run the `security-audit` skill on the changes being pushed before every `git push`.** No exceptions: not for small fixes, docs-only changes or a push the developer asked for in a hurry.
- Fix every finding, or get the developer to explicitly accept it, before pushing. Mention the audit result in your message when you push.
- If the audit can't run, don't push; say why.
- Everything a client sends the server is untrusted: message size and rate caps, strict parsing, inputs are five bits and nothing else. Room codes, names, replay links and anything else read from the URL or the socket: length caps, strict parsing, never `innerHTML`.

## Design canvas (two-way sync, strict)

The mockups live on the claude.ai design canvas **"Force Push — Mockups"**: https://claude.ai/artifact/CvekFxFmsvEAGt3Rfwiu6H (pages: Screens, Mobile, Characters & items, Art direction). `designs/*.jpg` are exports of its boards; `designs/README.md` maps each board to its file.

**Claude owns the designs.** The game, the docs and the canvas must always agree:

- **No downgrades.** A board is only ever replaced by something at least as complete and as polished: same or better art, detail, copy and states. Never swap a render for a placeholder or drop a state to make a task easier.
- **Improving the designs** is part of the job. When a board needs real design work (a new screen, a new state, a better layout), Claude may hand it to a subagent on **Fable 5.2** (`model: "fable"`) with the board files and this section as the brief, then review the result before publishing.
- **Game → canvas.** Any change to something a board shows (layout, colours, fonts, copy, HUD, the result diff, map names, power-ups, branches, the share line, phone layouts) updates that board in the same task, and its JPG in `designs/`. A task isn't done until both match.
- **Docs → canvas.** A decision in `GAME_PLAN.md` that changes what a board shows (a rule, a number, a word) updates the board in the same task.
- **Canvas → game.** The developer edits boards by hand. Before starting any UI or content task, re-read the boards it touches (Artifact `read`), and bring every difference into the code, the content files and `GAME_PLAN.md`. If a canvas change conflicts with the plan, ask.
- **Docs too.** `GAME_PLAN.md` §5–§10 (controls, rules, rooms, maps, HUD and result, look and tokens) describe the same things as the boards; keep them in step.
- **New looks are tried on the canvas first**, on a new page, then built in the game.
- **Numbers on boards must add up.** Diffs follow `GAME_PLAN.md` §6.5 (`+` minus `−` = tiles owned; shares add up to 100%), times follow the tick rules, ranges and counts follow §6.
- **Boards will show the real game:** once the game draws a screen, its board becomes a capture from the game (roadmap Phase 7: `npm run designs`, convert with `sips -s format jpeg -s formatOptions 82 --resampleWidth 1920`, copy into `designs/` (PT-BR) and `designs/en/`, upload as canvas assets and point each board's `<img>` at its new `/_blob/` id). The text boards (branches, items, art direction) are edited by hand on the canvas.
- If Claude can't regenerate a JPG export itself, list the stale files in `TODO_FOR_YOU.md`.

## Language rules (strict)

| What | Language |
|---|---|
| Code: identifiers, file/folder names, CSS classes, content keys, test names | **English** |
| Code comments, docstrings, commit messages, PR descriptions | **English** |
| Docs (`*.md`, including this file) | **English** |
| **Player-facing text** (UI, HUD, commit log lines, result, map and power-up names, share line, `<title>`/meta) | **English (default) and Brazilian Portuguese (PT-BR)**, both complete |

- There is **one small translation layer** with exactly two locales: `en` (default) and `pt-BR`. Don't add a third locale or an i18n library without asking.
- Player-facing strings live in locale content files (`src/content/locales/en.ts`, `src/content/locales/pt-BR.ts`), never inline in UI or logic code. Keys stay in English.
- Both locales have the same keys; a test fails on any missing or extra key and on slot mismatches (`{branch}` present in one locale but not the other).
- English copy is **written**, not machine-translated. The joke must land in English on its own ("Nobody will miss it.").
- Git words stay git words in both locales: `push`, `force-push`, `revert`, `merge`, `main`, `feature`, `hotfix`, `dev`.
- Player-facing text never names another game (`GAME_PLAN.md` D14).
- The locale changes words and number formatting only. It never changes the simulation, the score or a replay. Two players in one room can use different locales.
- The language toggle is on the landing screen and in the menu; the choice is remembered in `localStorage` (try/catch, works without it).
- Example: `const label = t("result.won", { branch })` is fine. `const label = "venceu"` is not.

## Testing rules

- **Every feature ships with tests.** A roadmap task isn't done until its tests are written and passing.
- Frameworks: **Vitest** (unit), **fast-check** (property-based), **Playwright** (smoke test, a two-client match through a real server, and later the board captures).
- Tests go in `tests/`, mirroring `src/` (`src/core/blast.ts` → `tests/core/blast.test.ts`). Server tests in `tests/server/`, e2e in `tests/e2e/`.
- Cover the logic: RNG, the grid and map validation, movement (tile to tile, corner rule, blocked by racks, boxes and pushes), force-push placement and fuse, blasts (arms stop at racks and on the first box, chains, painting), reverts (penalty tiles, respawn, grace, the duck), power-ups, scoring (the diff invariant), bots, the room (seats, start, drop-out, rematch), the protocol codec, the share line, locale completeness, and edge cases (corrupt `localStorage`, malformed messages, a player dropping mid-blast, zero input for a whole sprint).
- **Determinism is a test, not a hope:** `step` run twice on the same inputs gives identical state; Node and the three browser engines end a recorded match with the same state hash.
- **Netcode is a property test:** for random input streams and random per-client latency and jitter, every predicting client ends each tick in the server's state once the inputs arrive.
- **Invariants on every tick** (fast-check): `+` minus `−` equals owned tiles for every branch; owned + grey (+ frozen) = floor tiles; no player inside a rack or a box; a player is never on a tile with a push they didn't stand on when it was dropped.
- **Bots:** 1,000 seeded bot-only matches end without a stuck bot, and a bot never walks into a blast it could see.
- UI gets tests too: what's rendered for a given state, focus order, labels on every button. Test the state, not the pixels.
- Keep game logic out of UI and server code so it can be tested without a DOM, a canvas or a socket.
- Bug fixes start with a failing test that reproduces the bug (usually a seed + input log).
- Run the full check before every commit, and don't commit when it fails:
  ```sh
  npm run check && git commit ...
  ```
  (`npm run check` = lint + typecheck + unit tests + build + bundle-size budget.)

## Git workflow

- **Before every push, run the `security-audit` skill** (see the section at the top).
- Commit or push only when asked. Never push with failing checks.
- Work on feature branches off `origin/main` (`feat/…`, `fix/…`, `chore/…`); open PRs into `main` when asked. Never push to `main` directly.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): chain blasts that reach another force-push`. Scopes: `core`, `content`, `ui`, `net`, `server`, `tools`, `docs`, `designs`.
- Small, logical commits (one feature or chore each). Stage specific paths.
- Large binary assets (`.png`, `.jpg`, `.webp`, `.woff2`, `.ogg`, `.wav`) go through Git LFS (see `.gitattributes`); CI checks out with `lfs: true`.

## Code conventions

- TypeScript `strict: true`, no `any` (use `unknown` and narrow). ESLint + Prettier, enforced in CI.
- `camelCase` for variables and functions, `PascalCase` for types and classes, `CONSTANT_CASE` for module constants, `kebab-case` for file names.
- Content is data: maps (JSON), power-ups and their numbers, branches and their colours, bot weights, commit-log templates and highlight lines are typed data under `src/content/`, not hardcoded in logic. Adding a map means adding a JSON file, its names in both locales, and its tests.
- Runtime dependencies: **three.js** (client). The room host is a Cloudflare Worker with Durable Objects and needs no runtime package (Wrangler and the Workers types are dev dependencies). Nothing else without asking (no physics engine, no schema library, no state-sync framework). Dev dependencies are fine when they serve the stack above.
- In `src/core`: no `Math.random()`, no `Date.now()` / `new Date()` / `performance.now()`, no floating-point state (integers and ticks only), no DOM, no network. An ESLint rule enforces the bans.
- Time is ticks (20 per second). Positions are tiles plus a step counter.

## Architecture notes

- **Layout.** `src/core` is pure logic (no DOM, no canvas, no sockets, no globals). `src/content` is data and locale strings. `src/net` is the client side of the protocol (transport, prediction, reconciliation). `src/ui` draws state and turns keys and touches into inputs; it never owns game rules. `server/` is the room host; it imports `src/core` and adds only transport, validation and limits. `src/main.ts` wires the client.
- **Determinism.** A match is `seed + map + version + inputs`. `step(state, inputs) → state` advances one tick. Inputs are five bits per player per tick. The renderer interpolates between the last two states and never feeds anything back.
- **The room** (`src/core/room.ts`) owns seats, the tick, the input queue and `step`, behind a transport interface. Local transport (in the browser, bots only) for the first slice and for tests; WebSocket transport on the server.
- **Netcode** (`GAME_PLAN.md` §11): the server stamps inputs on arrival, runs `step`, broadcasts each tick's inputs, a hash every second, a snapshot on join or mismatch. The client predicts its own player, rolls back and re-runs on confirmation, and draws others from confirmed state, interpolated. `?lag=<ms>&jitter=<ms>` simulates a bad network (never linked from the UI).
- **Bots** live in `src/core/bot.ts`, read only the state, and are seeded. The server runs them for empty seats and dropped players; the local room runs them in the first slice.
- **Rendering.** three.js (`src/ui/render3d.ts`, models in `src/ui/models/`): instanced floor tiles, one sun with a shadow map, a fixed three-quarter camera over the whole map on wide screens and one that follows you on phones. Every model is generated by code from boxes with a bevel (racks, boxes, desks, developers, power-ups). Keep the maths, camera framing and model builders free of DOM so they stay unit-tested. HUD, lobby, result and menus are DOM.
- **Accessibility.** Menus, lobby and result are keyboard and screen-reader friendly; text contrast 4.5:1; colour never carries meaning alone (every tag has the branch name, every diff a sign); `prefers-reduced-motion` turns off screen shake and cuts blast particles. The four floor colours get a colour-blind check (roadmap Phase 0); if two collide, floor tiles get a per-branch pattern, tried on the canvas first.
- **Storage.** `localStorage` only, for per-player conveniences (name, language, last sprint length), always in try/catch. The server keeps a room in memory while it's open and nothing after. No accounts, no personal data.
- **Sharing.** The share line is built in `src/core` from the result and localised at the edge. Copy to clipboard with a visible fallback.
- **Test hooks.** `?test=1` exposes `window.__mc` with `play(inputs)`, `paused` and `&speed=N`; `&seed=N`, `&bots=N` and `&offline=1` (local room) set up a match; `&lag=` and `&jitter=` simulate the network. Used by the e2e tests and the board capture; never linked from the UI.
- **Performance budget.** First load under 250 KB gzipped JS+CSS (three.js included, fonts aside), interactive in under 2 s on a mid-range phone over 4G, 60 fps on that phone. No per-frame allocations in `step` or the render loop. A message under 16 bytes per player per tick.

## Workflow

- Work through `ROADMAP.md` in order. Mark tasks `[~]` when started and `[x]` when done and tested.
- Don't add scope that isn't in the roadmap without asking first.
- Keep `TODO_FOR_YOU.md` current: anything that needs the developer (decisions, accounts, domain, playtests) goes there, newest at the top of each section.
- Keep the design canvas, `designs/` and `GAME_PLAN.md` in sync with the game (see the section near the top).
