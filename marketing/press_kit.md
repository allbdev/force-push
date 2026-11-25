# Force Push: press kit (draft)

> Updated 22 Nov 2026 against the built game: every claim below is true of the code on `feat/core-match`. Still to fill at launch: the contact line, and the images once captured.

**Force Push** is a free online browser game for 2 to 4 players: an open-plan office, four git branches, and a `git push --force` that paints the floor in your colour. Whoever owns the most of the codebase when the sprint ends wins.

- **Play:** https://force-push.vinicius-albuquerque.com.br
- **Source:** https://github.com/allbdev/force-push (MIT)
- **Made by:** Vinícius Albuquerque Barros
- **Platforms:** any modern browser, desktop and phone. No install, no account, no ads.
- **Languages:** English and Brazilian Portuguese.

## In one line

A turf war in an open-plan office, where the result is a diff.

## What's in it

- Sprints of 2, 3 or 5 minutes for 2 to 4 players; empty seats are bots, so a match starts with one person. Rooms are a code (`FRI-1758`) or a link; extra people watch.
- Nobody is eliminated: get caught in a blast and you're "reverted" for four seconds, then back at your desk.
- Five power-ups from legacy boxes: coffee, a rubber duck, Stack Overflow, a second monitor and a rebase.
- Three maps (Open Space, Data Center, Rooftop Happy Hour with wind) and a map of the day, the same for everyone.
- The last 30 seconds are a code freeze: the edge of the map closes tile by tile.
- The result is a pull request: `main won: +212 −181 (31%)`, a share line, the biggest push replayed up close, and a replay link.

## For developers

- One deterministic simulation in integers, shared by the browser and the server; Chromium, Firefox, WebKit and Node end a recorded match on the same state hash.
- Client-side prediction with rollback, checked by a property test over random latency and jitter; a whole sprint played by two browsers through the real server in CI.
- Rooms on Cloudflare: one Durable Object per room, 6-byte inputs, 25-byte ticks.
- Bots written against the same simulation; 1,000 seeded bot matches in CI.
- A 3D office built entirely from code with three.js, in under 250 KB.

## Images

- `designs/en/` in the repository: screens captured from the game (after roadmap Phase 7).
- `public/og.jpg`: 1200 × 630 link preview.

## Contact

[CONTACT]
