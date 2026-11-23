# Force Push: press kit (draft)

> Draft written before the game exists. Every claim below must be true at launch; fill the placeholders then (roadmap task 59).

**Force Push** is a free online browser game for 2 to 4 players: an open-plan office, four git branches, and a `git push --force` that paints the floor in your colour. Whoever owns the most of the codebase when the sprint ends wins.

- **Play:** [GAME URL]
- **Source:** [REPO URL] (MIT)
- **Made by:** Vinícius Albuquerque Barros
- **Platforms:** any modern browser, desktop and phone. No install, no account, no ads.
- **Languages:** English and Brazilian Portuguese.

## In one line

A turf war in an open-plan office, where the result is a diff.

## What's in it

- Three-minute sprints for 2 to 4 players; empty seats are bots, so a match starts with one person.
- Nobody is eliminated: get caught in a blast and you're "reverted" for a few seconds, then back at your desk.
- Power-ups from legacy boxes: coffee, a rubber duck, and more range.
- The result is a pull request: `main won: +212 −181 (31%)`.

## For developers

- One deterministic simulation in integers, shared by the browser and the server.
- Client-side prediction with rollback, proven by property tests over random latency.
- Bots written against the same simulation.
- A 3D office built entirely from code with three.js.

## Images

- `designs/en/` in the repository: screens captured from the game (after roadmap Phase 7).
- `public/og.jpg`: 1200 × 630 link preview.

## Contact

[CONTACT]
