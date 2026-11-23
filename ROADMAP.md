# Roadmap — Force Push

> Tasks **in order**. Work top to bottom; move to the next phase only when the current phase's exit criteria are met.
> **The risky things get proven first:** that a match against bots is fun on one screen, then that it stays fun at 150 ms. The core and bots run in the browser before any server exists; the same room then moves to the server.
> Design details live in `GAME_PLAN.md`. Mockups on the design canvas and in `/designs`. Project rules in `CLAUDE.md`. Things only the developer can do in `TODO_FOR_YOU.md`.

**Language rule:** player-facing text in **English (default) and PT-BR**, both complete, through the two-locale content files. Code, comments and docs in English.

**Design rule:** any task that changes what a board shows also updates the board and its `designs/` JPG (see `CLAUDE.md`).

**Definition of done:** a task is `[x]` only when it's implemented **and covered by passing tests** (see `CLAUDE.md`).

**Target (from `GAME_PLAN.md`):** sprints of 3 minutes. The first version is 3 to 4 weekends. Every number below is a first guess.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 · Setup

1. [x] `git init`, public GitHub repo, MIT `LICENSE`, Git LFS (`.gitattributes` for the binary types), `.gitignore`; move the existing `designs/*.jpg` into LFS
2. [x] Vite + TypeScript strict scaffold (copy the setup from `../park-the-cart`); `src/core`, `src/content`, `src/net`, `src/ui`, `server/`, `tests/`, `public/`, `tools/`
3. [x] ESLint + Prettier, with a rule banning `Math.random`, `Date`, `performance.now` and DOM and network globals in `src/core`; `npm run check` (lint + typecheck + unit tests + build + size)
4. [x] Vitest + fast-check, first test; Playwright with a "page loads" smoke test (Chromium, Firefox, WebKit)
5. [~] GitHub Actions (written; the deploy waits for the Cloudflare secrets in `TODO_FOR_YOU.md`): `check` + e2e on every push/PR; deploy `main` to Cloudflare (a Worker serving `dist/` as static assets, on `force-push.vinicius-albuquerque.com.br`)
6. [x] Fonts self-hosted (Space Grotesk, JetBrains Mono; OFL, full PT-BR accents) and the colour tokens from `GAME_PLAN.md` §10 as CSS custom properties
7. [x] Locale layer: `t(key, slots)`, `en` default + `pt-BR`, toggle remembered in `localStorage`; test that both locales have the same keys and slots
8. [x] `tools/size-check.ts` (`npm run size`): bundle budget from `CLAUDE.md`, part of `check`
9. [x] Colour-blind check of the four branch colours on the floor (protanopia, deuteranopia, tritanopia); if two collide, try a per-branch floor pattern on a new canvas page first. *Result (22 Nov 2026): hotfix/dev collide under deuteranopia (ΔE00 8.6) and grey sits close to dev and hotfix; floor tiles get per-branch patterns (task 20).*

**Exit:** the empty page builds, deploys, and CI is green.

---

## Phase 1 · Core: the match (no network)

> Pure logic in `src/core`, tested without a DOM, plus the thinnest view to play it.

10. [x] Seeded RNG + tests for repeatability and distribution
11. [x] Grid and map format, the Open Space JSON, the hand-written validator (desk in a rack, unreachable desk, unknown keys); seeded boxes and hidden drops
12. [x] Movement: tile to tile, step counter, the corner rule, blocked by racks, boxes and pushes; coffee speed
13. [x] Force-push: placement, carry limit, fuse; blasts in a cross (stop at racks, break the first box), chains, painting
14. [x] Reverts: blast lingering, the 4 s out, the 3 penalty tiles, respawn with grace, the rubber duck; Stack Overflow range
15. [x] Scoring: `+` and `−`, shares of painted tiles, ties; property test of the diff invariant and tile conservation on every tick
16. [x] `step(state, inputs)` as a pure function; determinism test (twice → identical state); state hash
17. [x] Bots: danger map, goal scoring, safe push rule; 1,000 seeded bot-only matches with no stuck bot and no walk into a visible blast
18. [x] The room (`src/core/room.ts`) behind a transport interface, with a local transport: seats, start, sprint timer, end, rematch
19. [x] Sandbox view: *went straight to the 3D view*; `?offline=1&seed=N` plays against bots, `&bots=4` watches an all-bot match

**Exit (kill test, in `TODO_FOR_YOU.md`):** the developer plays three 3-minute matches against three bots in the sandbox and wants a fourth. A comeback in the last 20 seconds happens at least once.

---

## Phase 2 · Vertical slice: one offline match, start to result

> Re-read the screen boards before starting each screen (see `CLAUDE.md`).

20. [x] three.js arena: instanced floor tiles that take the branch colours, racks, boxes, desks, walls; one sun with shadows; the fixed three-quarter camera; models built by code from bevelled boxes
21. [x] Developers: the blocky kit with the four accessories (glasses, headphones, laptop, cap and beard), walk and fall animations; power-ups on plates; the force-push orb and the blast
22. [x] Match HUD (board 3): timer, territory bar, room code, name tags, "push -f in Ns", "+N tiles → branch", floor labels, commit log, pushes and range, control hint
23. [x] Reverted (board 5): desaturated arena, `$ git revert`, who did it, countdown, the penalty line
24. [x] Result (board 7): PR header, winner, per-branch diff and share, highlights, rematch / change map / share; share line localised at the edge
25. [x] Landing (board 1): title, the `<<<<<<< HEAD` frame, create room / join with code, branch tags, language toggle; in this phase "create room" starts an offline room with bots
26. [x] Touch controls and the portrait layout (board "Phone layouts"): four-way stick, push button, the camera that follows you; a real-phone check goes in `TODO_FOR_YOU.md`

**Exit (in `TODO_FOR_YOU.md`):** the developer plays the slice on desktop and on a phone, against bots, and the result screen makes them want a rematch.

---

## Phase 3 · Online

27. [x] `server/`: a Durable Object per room with the WebSocket transport around the same room, in the same Worker as the client; local dev server (`npm run server`, Wrangler)
28. [x] Protocol codec: join, input (`seq` + five bits), tick inputs, hash, snapshot, lobby updates; property test (encode → decode); malformed-message tests with size caps
29. [x] Server limits: message size and rate, join rate per address, names checked, rooms closed when empty
30. [x] Client prediction and rollback (`src/net`); interpolation of other players; ping on the HUD
31. [x] Netcode property test: random inputs, latency and jitter per client → every client converges to the server's state; `?lag=&jitter=` simulator
32. [x] Room codes and links (`?room=FRI-1758`), the lobby (board 2): seats, names, ready states, map, sprint length, start, leave, the status terminal
33. [x] Drop-out and rejoin (a bot holds the seat); rematch in the same room
34. [x] Playwright: two browser clients and a bot play a whole match through a real server and end with the same result
35. [~] Deploy the rooms with the client (same Worker); production config (*ready; waits for the Cloudflare secrets in `TODO_FOR_YOU.md`*)

**Exit (in `TODO_FOR_YOU.md`):** two people on two phones over 4G, plus two bots, play a match that feels fair.

---

## Phase 4 · First version complete

36. [x] Phone layouts for lobby and result (board "Phone layouts")
37. [x] Keyboard and screen-reader pass on every menu, the lobby and the result; focus order tests
38. [x] `prefers-reduced-motion`: no screen shake, fewer particles
39. [x] Settings saved in `localStorage` (name, language, sprint length), corrupt-storage tests
40. [~] Performance budget check (bundle size, 60 fps and load on a mid-range phone; real phone check in `TODO_FOR_YOU.md`) (*bundle ≈170 KB of 250 KB*)
41. [x] Open Graph image and meta tags for link previews, in both locales

**Exit:** the first version from `GAME_PLAN.md` §4 is playable online end to end on desktop and phone, in both languages.

---

## Phase 5 · Second version

42. [x] Second monitor and rebase power-ups
43. [x] Code freeze (board 6): the closing ring, frozen tiles, red timer, respawn rule
44. [x] Maps: Data Center and Rooftop Happy Hour (wind), map select (board 8)
45. [x] Replays: seed + map + version + inputs as a link; untrusted-input tests; cross-browser state-hash test (Chromium, Firefox, WebKit, Node)
46. [x] End-of-match highlight replay with the close camera (board 4)
47. [x] Spectators (join a full room to watch)
48. [x] Daily map: generated from the date, bots must finish it, re-roll otherwise
48b. [x] Closed seats (asked for 23 Nov 2026): the host switches empty seats between bot and closed for a 1v1 or three-way match, online and offline; boards 2 and 2b

---

## Phase 6 · Art polish

> Claude makes the art by code (`GAME_PLAN.md` D12).

49. [x] The office around the arena: desks, monitors, chairs, glass walls, plants; daylight and shadows to match board 3
50. [x] Painted-tile glow, blast flash and box debris; landing hero scene (board 1)
51. [ ] Character kit shared with Deploy na Sexta (one module, both games)

---

## Phase 7 · Design sync tooling

52. [x] `tools/designs/`: Playwright captures every screen board from the real game (fixed seed, fixed input log, fixed tick) at board size
53. [ ] Upload the captures to the canvas and replace the drawn screen mockups; refresh `designs/` JPGs (no downgrades: a capture replaces a mockup only when it is at least as good)
54. [ ] English versions of the screen boards on the canvas (English is the default locale; the mockups are in PT-BR for now)

---

## Phase 8 · Launch

55. [x] README: architecture write-up, the netcode diagram, determinism, bots, how to replay a bug
56. [ ] Playtests: 5 sessions of 4, at least 2 people on phones and 2 English speakers
57. [ ] Tune fuse, ranges, drop rates and bots from playtests
58. [ ] Final name check (`TODO_FOR_YOU.md`)
59. [ ] Press kit and launch posts (`marketing/`)

---

## Later (not in the first or second version)

- A ranked or seasonal mode
- Custom maps from JSON
- Share as an image
