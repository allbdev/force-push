# Force Push

**Author:** Vinícius Albuquerque Barros · **Written:** 22 Nov 2026 · **Status:** plan and mockups only, nothing built. The full plan is `GAME_PLAN.md`; where the two differ, `GAME_PLAN.md` wins

Free, open-source, 3D, played in the browser from a link. Effort figures are estimates, not measurements.

**Pitch:** Bomberman in an open-plan office. Your bomb is a `git push --force`: the blast overwrites the floor with your branch colour. Whoever owns most of the codebase when the sprint ends wins.

## The three-minute loop

1. Open a link or type a room code. 2 to 4 players, each a branch: `main`, `feature`, `hotfix`, `dev`.
2. Walk the grid and drop a force-push. Three seconds later it blasts in a cross and paints every tile it reaches in your colour.
3. Blasts break cardboard boxes and desks (which hide power-ups) and stop at server racks.
4. Caught in someone else's blast: you are "reverted", lose a few seconds and respawn at your desk. Nobody is eliminated, so nobody sits out.
5. When the sprint timer hits zero, the tiles are counted. The result is a diff: `+212 −181`, and a share line.

## Rules worth fixing early

- **Score is territory, not kills.** This is the difference from Bomberman and from the open-source clones: a losing player can still repaint the map in the last 20 seconds.
- **Power-ups (in boxes):** Coffee (speed), Rubber duck (survive one blast), Stack Overflow (blast +1 tile), Second monitor (carry +1 force-push), Rebase (your next blast also repaints tiles through one rack).
- **Sudden death:** in the last 30 seconds "code freeze" closes the outer ring, tile by tile.
- **Maps:** Open space, Data center (more racks, narrow aisles), Rooftop happy hour (wind pushes force-pushes one tile).

## Scope

**First version**
- One map, 2 to 4 players, room codes, bots to fill empty seats.
- Three power-ups (coffee, duck, Stack Overflow).
- Result screen as a diff, share line.

**Later**
- Two more maps, the other power-ups, code freeze.
- Spectators, rematch, a daily map everyone plays.
- Replays from the input log.

## Architecture

- **Rendering:** three.js. Fixed three-quarter camera, one directional light with shadows, instanced tiles. A 13 × 11 grid is small enough for phones.
- **Simulation:** a pure, deterministic function `step(state, inputs) -> state` on a fixed tick (20 per second). Movement is tile-to-tile, so there is no physics to disagree about.
- **Networking:** one authoritative room per match on a WebSocket server (Colyseus on a small Node process, or a PartyKit/Durable Object room). Clients send inputs, apply their own movement at once, and reconcile with the server tick. Check current free-tier limits before choosing; I have not.
- **Why this is the easy one:** grid movement plus a deterministic step means the server is the same code as the client. The whole game logic is unit-testable without a browser.
- **Shared with Deploy na Sexta:** the blocky developer character kit, the room/lobby code, the Vite + TypeScript + Vitest + CI scaffold.

## What it shows

- Deterministic simulation shared between client and server.
- Client-side prediction and reconciliation, explained in the README with a diagram.
- Property tests: for random input streams, client and server end in the same state.
- Bots written against the same `step` function.

## Risks

| Risk | Mitigation |
|---|---|
| Empty lobbies | Bots from the first version; a match can start with one human |
| Lag on a twitchy game | Three-second fuse and tile movement tolerate 100–150 ms; show ping |
| "Just another Bomberman clone" | Territory scoring, no elimination, the diff result screen |
| The name is taken | Renamed from Merge Conflict (taken by a Global Game Jam game) to Force Push on 22 Nov 2026; check the new name before launch |

**Effort (estimate):** 3 to 4 weekends for the first version. Add 1 to 2 if this is the first project on the shared scaffold.

## Look

A bright miniature office seen from above, like a desk diorama: carpet tiles, cardboard boxes, server racks, glass walls. Characters are blocky toy developers in hoodies, sharp-edged on purpose (not the round cartoon of Dig to Japan). Painted tiles glow in the four branch colours. The interface is a code editor: dark panels, monospace, diff green and red, branch names as player tags. Mockups are in the design canvas "Force Push — Mockups" (https://claude.ai/artifact/CvekFxFmsvEAGt3Rfwiu6H) and in `designs/`. All names, numbers and lines in the mockups are first drafts.

## What already exists

A quick search on 22 Nov 2026, not exhaustive.

- Open-source browser Bomberman clones are common, including one built with Babylon.js and Colyseus.
- Git-themed games exist but are different games: *Merge Conflict* (a Global Game Jam local co-op puzzle on itch.io) and *GitWars* (a two-player local jam game about merge conflicts).
- I did not find a Bomberman-style game with territory scoring and a git theme.

Sources:
- https://yarenlen.itch.io/merge-conflict
- https://0xonyx.itch.io/gitwars
- https://forum.babylonjs.com/t/open-source-multiplayer-game-bomberman-mayhem/49522
- https://github.com/aaruza/BugOverflow
