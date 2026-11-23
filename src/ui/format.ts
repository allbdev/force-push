/** Turning game numbers and events into words, in the current locale. */
import { BRANCHES } from "../content/branches";
import { POWER_UPS } from "../content/power-ups";
import { TICKS_PER_SECOND } from "../content/rules";
import { SITE_HOST } from "../content/site";
import type { ShareData } from "../core/share";
import type { GameEvent } from "../core/state";
import { hash32 } from "../core/rng";
import { t } from "./i18n";

/** "01:42" from ticks left (rounded up, so 0:00 shows only at the very end). */
export function formatClock(ticks: number): string {
  const s = Math.max(0, Math.ceil(ticks / TICKS_PER_SECOND));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function branchName(seat: number): string {
  return BRANCHES[seat] ?? "?";
}

export function powerUpLabel(code: number): string {
  const kind = POWER_UPS[code - 1];
  return kind ? t(`powerUps.${kind}`) : "";
}

export function powerUpShort(code: number): string {
  const kind = POWER_UPS[code - 1];
  return kind ? t(`powerUpsShort.${kind}`) : "";
}

/** A fake but stable commit hash for a log line. */
export function commitHash(seed: number, tick: number, index: number): string {
  return (hash32(seed, tick, index) & 0xffffff).toString(16).padStart(6, "0");
}

export type LogLine = { readonly seat: number; readonly text: string };

/** One commit-log line per event worth logging, or null. */
export function logLine(event: GameEvent): LogLine | null {
  switch (event.type) {
    case "blast":
      if (event.gained === 0) return null;
      return {
        seat: event.seat,
        text: t("log.push", {
          branch: branchName(event.seat),
          gained: event.gained,
          taken: event.taken,
        }),
      };
    case "pickup":
      return {
        seat: event.seat,
        text: t("log.pickup", { branch: branchName(event.seat), item: powerUpShort(event.kind) }),
      };
    case "revert":
      return {
        seat: event.seat,
        text:
          event.by < 0
            ? t("log.self", { branch: branchName(event.seat) })
            : t("log.revert", { branch: branchName(event.seat), by: branchName(event.by) }),
      };
    case "duck":
      return { seat: event.seat, text: t("log.duck", { branch: branchName(event.seat) }) };
    default:
      return null;
  }
}

/** The share line, four lines of plain text. */
export function shareText(data: ShareData): string {
  const winner =
    data.winners.length > 1
      ? t("share.tie", { branches: data.winners.map(branchName).join(" + ") })
      : t("share.won", { branch: branchName(data.winners[0] ?? 0) });
  return [
    t("share.room", { code: data.code }),
    t("share.diff", { winner, plus: data.plus, minus: data.minus, share: data.share }),
    t("share.match", { pushes: data.pushes, reverts: data.reverts }),
    SITE_HOST,
  ].join("\n");
}
