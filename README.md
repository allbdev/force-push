# Force Push

> *Your bomb is a `git push --force`.* A free 3D browser game for 2 to 4 players: walk an open-plan office, drop force-pushes, and paint the floor in your branch's colour. Whoever owns the most of the codebase when the sprint ends wins. The result is a diff.

**Status:** plan and mockups done; setup (roadmap Phase 0) in progress. It will live at https://force-push.vinicius-albuquerque.com.br, hosted on Cloudflare.

Player-facing text will be English by default, with a Brazilian Portuguese toggle. Code, comments and docs are in English.

| Doc | What's in it |
|---|---|
| [`GAME_PLAN.md`](GAME_PLAN.md) | Design, the rules and their numbers, rooms, maps, look and tokens, architecture and netcode, risks |
| [`ROADMAP.md`](ROADMAP.md) | Ordered task list and current progress |
| [`CLAUDE.md`](CLAUDE.md) | Project rules (language, testing, git workflow, design sync, architecture) |
| [`TODO_FOR_YOU.md`](TODO_FOR_YOU.md) | Open decisions and things only the developer can do |
| [`FORCE_PUSH.md`](FORCE_PUSH.md) | The original one-page pitch |
| [`designs/`](designs) | Exports of the design canvas boards: screens, phone layouts, the branches, items and art direction |
| [`marketing/`](marketing) | Press kit and launch posts (drafts) |

## How it plays

1. Open a link or type a room code (`FRI-1758`). Four seats, four branches: `main`, `feature`, `hotfix`, `dev`. Empty seats are bots.
2. Drop a force-push. Three seconds later it blasts in a cross and paints every tile it reaches in your colour.
3. Blasts break legacy boxes (some hide coffee, a rubber duck or Stack Overflow) and stop at server racks.
4. Caught in a blast, you're reverted: 4 seconds out and 3 tiles lost. Nobody is eliminated.
5. When the sprint ends, the tiles are counted: *"main won: +212 −181 (31%)"*. Rematch.

## The interesting problem

A match is a pure function of a seed, a map and everyone's inputs: `step(state, inputs) → state`, 20 times a second, in integers only. The same code runs in the browser and on the server.

- **Server authority, client prediction.** Clients send five bits per tick. The server runs `step` and broadcasts each tick's inputs; each client runs ahead with its own inputs and rolls back when the server's arrive. A property test drives random inputs through random latency and checks that every client converges to the server.
- **Bots on the same `step`.** Bots read a danger map of pending blasts and only drop a push they can escape. 1,000 seeded bot matches run in CI.
- **Territory, not kills.** `+` counts tiles you painted, `−` tiles you lost, and `+ − −` is what you own: an invariant checked on every tick.
- **3D from code.** Every model is a bevelled box built at load and drawn with three.js.

The write-up with the netcode diagram comes with the code (roadmap task 55).

## Requirements

- **Node.js 22 LTS** and npm
- **Git LFS** (the design JPGs are stored in LFS)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | Lint, typecheck, unit tests, build and the bundle-size budget (run before every commit) |
| `npm run e2e` | Playwright in Chromium, Firefox, WebKit and a phone |
| `npm run colours` | The colour-blind check of the floor colours |
| `npm run deploy` | Build and deploy to Cloudflare (needs Wrangler credentials) |

## Contributing workflow

1. Pick the next task in `ROADMAP.md`.
2. Write the feature together with its tests, keeping logic in `src/core/`.
3. If it changes something a design board shows, update the board (see `CLAUDE.md`).
4. Run `npm run check` and make sure it passes.
5. Commit. Before every push, run the `security-audit` skill on the changes (see `CLAUDE.md`).

## License

MIT (see `LICENSE`). Fonts: Space Grotesk and JetBrains Mono, both under the SIL Open Font License, self-hosted.
