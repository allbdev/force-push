import { parseMap, type MapDef } from "../core/map";
import openSpace from "./maps/open-space.json";

/** Maps, validated at load: a broken map file fails the build's tests, not a match. */
function load(json: unknown): MapDef {
  const result = parseMap(json);
  if (!result.ok) throw new Error(`Invalid map: ${result.error}`);
  return result.map;
}

export const MAPS: readonly MapDef[] = [load(openSpace)];
export const DEFAULT_MAP_ID = "open-space";

export function mapById(id: string): MapDef | undefined {
  return MAPS.find((m) => m.id === id);
}
