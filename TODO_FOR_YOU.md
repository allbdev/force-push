# What I need from you

> Things only you can do (decisions, accounts, people). Claude keeps this list current while working; newest items at the top of each section.
> Last updated: 22 Nov 2026. Repo, domain, host and the Stack Overflow name decided; the three stale board exports replaced. Phase 0 (setup) in progress.

## To do now

- [ ] **Cloudflare deploy access** (roadmap task 5). For CI to deploy the Worker, add two repository secrets on GitHub (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (a token from the "Edit Cloudflare Workers" template, scoped to your account and the `vinicius-albuquerque.com.br` zone) and `CLOUDFLARE_ACCOUNT_ID`. Until then the deploy job is skipped and CI only checks.
- [ ] **Cloudflare free-tier limits.** I haven't checked the current limits for Workers and Durable Objects (requests, duration, WebSocket messages). Please check, or tell me to. Needed by Phase 3, not before.
- [ ] **Read `GAME_PLAN.md` §6 (the rules).** Every number there is a first draft I picked so the mockups add up: fuse 3 s, range 2, 2 pushes carried, 4 s out after a revert, 3 penalty tiles, coffee 10 s, 30% of boxes hide a power-up. Tell me anything that feels wrong before Phase 1.
- [ ] **Stale JPG export:** `designs/07-Result.jpg` shows `[SEU DOMÍNIO]` at the end of the share line; the canvas board now shows the real domain (22 Nov 2026). Please export board *7 · Result* again when convenient.

## Decisions (quick)

- [x] ~~**Room host.**~~ **Cloudflare** since 22 Nov 2026: one Worker serves the client as static assets and runs a Durable Object per room (`GAME_PLAN.md` D6). Tell me if you meant only the rooms and want the client on GitHub Pages like Park the Cart.
- [x] ~~**Repo.**~~ `allbdev/force-push`, public, MIT (22 Nov 2026).
- [x] ~~**Domain.**~~ `force-push.vinicius-albuquerque.com.br` (22 Nov 2026), served by the Worker as a custom domain (Cloudflare creates the DNS record on first deploy).
- [x] ~~**"Stack Overflow" as a power-up name.**~~ Kept as a nod (22 Nov 2026).
- [x] ~~**Name.**~~ **Force Push** since 22 Nov 2026 (was Merge Conflict, which a Global Game Jam game already uses). I'll check the new name on itch.io and the stores before launch. (Roadmap task 58)
- [ ] **Phones, portrait or landscape?** The board shows portrait with a following camera. Park the Cart switched to landscape after you played it on a phone. I'm keeping portrait as drawn and will ask again after the phone check in Phase 2.

## Art

- [ ] **Who makes the art.** My plan: I build it in code (every model is a bevelled box, which suits code well), like Park the Cart. The renders on the canvas are the target. If you'd rather use authored models (for example the Deploy na Sexta kit, if it exists as files), tell me where they are.

## Design canvas

- [ ] **If you change anything on the canvas**, tell me and I'll bring it into the docs and the code (see `CLAUDE.md`). The screen mockups are in PT-BR; English versions come with the game captures (roadmap task 54).

## Playtesting (needs people)

- [ ] **Kill test** (end of Phase 1): three 3-minute matches against three bots in the sandbox. Do you want a fourth?
- [ ] **Slice test** (end of Phase 2): an offline match on desktop and on a phone, in 3D. Does the result make you want a rematch?
- [ ] **Online test** (end of Phase 3): two people on two phones over 4G, plus two bots.
- [ ] **Playtests** (roadmap task 56): 5 sessions of 4 players, at least 2 on phones and 2 English speakers.
