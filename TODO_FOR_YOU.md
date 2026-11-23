# What I need from you

> Things only you can do (decisions, accounts, people). Claude keeps this list current while working; newest items at the top of each section.
> Last updated: 22 Nov 2026. The game is built (phases 0–7, see `ROADMAP.md`) on the local branch `feat/core-match`, in small commits. **Nothing after the first commit has been pushed**: the project rules say push only when asked, and every push needs a security audit first.

## To do now

- [ ] **Push and review the work.** All of it is on the local branch `feat/core-match` (based on `main` after the first commit). Say "push it" and I'll run the security audit, push the branch and open a PR into `main`; or push it yourself: `git push -u origin feat/core-match`.
- [ ] **Cloudflare deploy access** (roadmap tasks 5 and 35). For CI to deploy the Worker (client and rooms), add two repository secrets on GitHub (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template, scoped to your account and the `vinicius-albuquerque.com.br` zone) and `CLOUDFLARE_ACCOUNT_ID`. Until then the deploy job is skipped. Or deploy by hand once: `npx wrangler login`, then `npm run deploy`. The Worker uses a Durable Object (`RoomObject`, SQLite-backed class, free plan friendly) and the Workers rate-limiting binding (`JOIN_LIMIT`); Cloudflare creates the custom-domain DNS record on first deploy.
- [ ] **Cloudflare free-tier limits.** I haven't checked the current limits for Workers, Durable Objects (requests, duration, WebSocket messages) and the rate-limiting binding. Please check, or tell me to. A room sends 20 small messages a second to each player while a sprint runs and nothing when empty.
- [ ] **Play it.** `npm run dev` (offline: "Play against bots") or `npm run server` then open http://localhost:8787 in two windows for an online room.
  - *Kill test* (end of Phase 1): three 3-minute matches against three bots. Do you want a fourth? Did a comeback happen in the last 20 seconds?
  - *Slice test* (end of Phase 2): on desktop and on a phone. Does the result make you want a rematch?
  - *Online test* (end of Phase 3): two people on two phones over 4G, plus two bots, once it's deployed.
- [ ] **Read `GAME_PLAN.md` §6 (the rules).** Every number is a first draft: fuse 3 s, range 2, 2 pushes carried, 4 s out after a revert, 3 penalty tiles, coffee 10 s, 30% of boxes hide a power-up, the code freeze on in every room. Tell me anything that feels wrong.
- [ ] **Stale JPG exports:** `designs/07-Result.jpg` (the share line now shows the domain), `designs/11-Items.jpg` (the board gained the rebase power-up) and the new board *Floor patterns* (export it as `designs/13-Floor.jpg`). I can't export boards from the canvas myself. `npm run designs` captures every screen from the real game into `design-captures/` (PNG + JPG, both locales) if you'd rather use captures for the screen boards (roadmap task 53).

## Decisions (quick)

- [x] ~~**Room host.**~~ **Cloudflare** since 22 Nov 2026: one Worker serves the client as static assets and runs a Durable Object per room (`GAME_PLAN.md` D6). Tell me if you meant only the rooms and want the client on GitHub Pages like Park the Cart.
- [x] ~~**Repo.**~~ `allbdev/force-push`, public, MIT (22 Nov 2026).
- [x] ~~**Domain.**~~ `force-push.vinicius-albuquerque.com.br` (22 Nov 2026), served by the Worker as a custom domain (Cloudflare creates the DNS record on first deploy).
- [x] ~~**"Stack Overflow" as a power-up name.**~~ Kept as a nod (22 Nov 2026).
- [x] ~~**Name.**~~ **Force Push** since 22 Nov 2026 (was Merge Conflict, which a Global Game Jam game already uses). I'll check the new name on itch.io and the stores before launch. (Roadmap task 58)
- [ ] **Phones, portrait or landscape?** Built portrait with a following camera, as the board shows. Park the Cart switched to landscape after you played it on a phone; tell me after you try this one.
- [ ] **Code freeze in every room?** It's on for every sprint (the second-version rule). Say if you'd rather make it a lobby option.

## Art

- [x] ~~**Who makes the art.**~~ Built in code (every model a bevelled box), checked against the canvas renders.
- [ ] **The character kit shared with Deploy na Sexta** (roadmap task 51): the developers live in `src/ui/models/developer.ts`. Tell me where Deploy na Sexta's code is and I'll make it one module both games use.

## Design canvas

- [ ] **If you change anything on the canvas**, tell me and I'll bring it into the docs and the code (see `CLAUDE.md`). The screen mockups are in PT-BR; English versions come with the game captures (roadmap task 54).

## Playtesting (needs people)

- [ ] **Kill, slice and online tests:** see "Play it" above.
- [ ] **Performance on a mid-range phone** (roadmap task 40): 60 fps and interactive in under 2 s over 4G. The bundle is about 170 KB gzipped of the 250 KB budget, three.js included; I can't measure a real phone.
- [ ] **Playtests** (roadmap task 56): 5 sessions of 4 players, at least 2 on phones and 2 English speakers.
