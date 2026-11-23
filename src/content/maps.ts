import { parseMap, type MapDef } from "../core/map";
import { dailyMap } from "../core/daily";
import dataCenter from "./maps/data-center.json" with { type: "json" };
import openSpace from "./maps/open-space.json" with { type: "json" };
import rooftop from "./maps/rooftop.json" with { type: "json" };

/** Maps, validated at load: a broken map file fails the build's tests, not a match. */
function load(json: unknown): MapDef {
  const result = parseMap(json);
  if (!result.ok) throw new Error(`Invalid map: ${result.error}`);
  return result.map;
}

export const MAPS: readonly MapDef[] = [load(openSpace), load(dataCenter), load(rooftop)];
export const DEFAULT_MAP_ID = "open-space";

/** A shipped map, or the map of the day for a `daily-YYYYMMDD` id. */
export function mapById(id: string): MapDef | undefined {
  return MAPS.find((m) => m.id === id) ?? dailyMap(id);
}
