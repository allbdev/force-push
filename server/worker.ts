/**
 * The Cloudflare Worker (GAME_PLAN.md D6): serves the built client, creates rooms, and hands each
 * room's WebSockets to its Durable Object. Only `/api/*` runs here; everything else is a static
 * asset.
 *
 *   POST /api/room                 → { code }   a fresh room
 *   GET  /api/room/FRI-1758/ws     → WebSocket  (Origin must be the site, or localhost in dev)
 */
import { makeRoomCode, parseRoomCode } from "../src/core/room-code";
import { originAllowed } from "./origin";
import { RoomObject } from "./room-object";

export { RoomObject };

export type Env = {
  readonly ROOMS: DurableObjectNamespace;
  readonly ASSETS: Fetcher;
  /** Workers rate limiting (optional: missing in some local setups). */
  readonly JOIN_LIMIT?: RateLimit;
  /** Set only by `npm run server` (wrangler dev --var): lets localhost pages connect. */
  readonly ALLOW_DEV_ORIGINS?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function limited(env: Env, req: Request): Promise<boolean> {
  if (!env.JOIN_LIMIT) return false;
  const key = req.headers.get("cf-connecting-ip") ?? "local";
  const { success } = await env.JOIN_LIMIT.limit({ key });
  return !success;
}

function randomU32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const dev = env.ALLOW_DEV_ORIGINS === "1";
    if (!originAllowed(req.headers.get("origin"), req.url, dev))
      return json({ error: "origin" }, 403);
    if (await limited(env, req)) return json({ error: "rate" }, 429);

    if (url.pathname === "/api/room" && req.method === "POST") {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeRoomCode([randomU32(), randomU32(), randomU32(), randomU32()]);
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch(`https://room/create?code=${code}`, { method: "POST" });
        if (res.status === 201) return json({ code }, 201);
      }
      return json({ error: "busy" }, 503);
    }

    const m = /^\/api\/room\/([A-Za-z0-9-]{1,16})\/ws$/.exec(url.pathname);
    if (m && req.method === "GET") {
      const code = parseRoomCode(m[1]);
      if (!code) return json({ error: "code" }, 400);
      if (req.headers.get("upgrade")?.toLowerCase() !== "websocket")
        return json({ error: "upgrade" }, 426);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request(`https://room/ws?code=${code}`, req));
    }
    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
