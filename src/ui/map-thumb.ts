/**
 * A small top-down picture of a map (racks, floor, the four desks), drawn from its definition so
 * every map, the daily one included, gets a thumbnail without an image file.
 */
import { BRANCHES, BRANCH_COLOURS, FLOOR_GREY } from "../content/branches";
import type { MapDef } from "../core/map";

export function drawMapThumb(map: MapDef, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = "#b5a68c";
  ctx.fillRect(0, 0, width, height);
  const cell = Math.min((width - 8) / map.width, (height - 8) / map.height);
  const ox = (width - cell * map.width) / 2;
  const oy = (height - cell * map.height) / 2;
  const racks = new Set(map.racks);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = racks.has(y * map.width + x) ? "#22252f" : FLOOR_GREY;
      ctx.fillRect(ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1);
    }
  }
  BRANCHES.forEach((b) => {
    const [x, y] = map.desks[b];
    ctx.fillStyle = BRANCH_COLOURS[b];
    ctx.fillRect(ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1);
  });
  if (map.wind) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${Math.round(cell * 1.4)}px sans-serif`;
    ctx.fillText(
      ["↑", "→", "↓", "←"][map.wind.dir]!,
      ox + cell * 0.2,
      oy + map.height * cell - cell * 0.3,
    );
  }
  return canvas;
}
