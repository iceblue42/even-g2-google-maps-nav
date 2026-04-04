import type { LatLng } from '../state/types';
import { latLngToTileXY } from '../utils/geo';

const TILE_SIZE = 256;
const TILE_URL = 'https://basemaps.cartocdn.com/dark_all';

// Tile cache: key = "z/x/y", value = HTMLImageElement
const tileCache = new Map<string, HTMLImageElement>();
const MAX_CACHE = 60;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

async function getTile(z: number, x: number, y: number): Promise<HTMLImageElement> {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;

  const img = await loadImage(`${TILE_URL}/${z}/${x}/${y}.png`);

  if (tileCache.size >= MAX_CACHE) {
    const firstKey = tileCache.keys().next().value;
    if (firstKey) tileCache.delete(firstKey);
  }

  tileCache.set(key, img);
  return img;
}

export function getZoomForMode(mode: string): number {
  switch (mode) {
    case 'walking': return 17;
    case 'bicycling': return 16;
    case 'transit': return 15;
    default: return 16;
  }
}

/** Draw a navigation arrow (chevron pointing up) at the center of the canvas. */
function drawNavigationArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const size = 12;

  // Arrow body (triangle pointing up)
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);           // tip
  ctx.lineTo(cx - size * 0.7, cy + size * 0.6); // bottom-left
  ctx.lineTo(cx, cy + size * 0.2);     // notch
  ctx.lineTo(cx + size * 0.7, cy + size * 0.6); // bottom-right
  ctx.closePath();

  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#00cc00';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Small inner triangle for depth
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.5);
  ctx.lineTo(cx - size * 0.35, cy + size * 0.3);
  ctx.lineTo(cx, cy + size * 0.1);
  ctx.lineTo(cx + size * 0.35, cy + size * 0.3);
  ctx.closePath();
  ctx.fillStyle = '#00ff44';
  ctx.fill();
}

/**
 * Render a navigation-style map: heading-up orientation with route and direction arrow.
 * The map rotates so the user's bearing always points up.
 */
export async function renderMap(
  center: LatLng,
  routePolyline: LatLng[],
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  bearingDeg: number = 0
): Promise<number[]> {
  const { x: fx, y: fy } = latLngToTileXY(center.lat, center.lng, zoom);
  const centerTileX = Math.floor(fx);
  const centerTileY = Math.floor(fy);

  // Fetch 3x3 grid of tiles around center
  const tilePromises: Promise<HTMLImageElement>[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tilePromises.push(getTile(zoom, centerTileX + dx, centerTileY + dy));
    }
  }

  let tiles: HTMLImageElement[];
  try {
    tiles = await Promise.all(tilePromises);
  } catch (e) {
    console.warn('[MapRenderer] Some tiles failed to load:', e);
    return [];
  }

  // Create composite canvas (3x3 tiles = 768x768)
  const compositeSize = TILE_SIZE * 3;
  const composite = document.createElement('canvas');
  composite.width = compositeSize;
  composite.height = compositeSize;
  const ctx = composite.getContext('2d')!;

  // Draw tiles
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileIdx = (dy + 1) * 3 + (dx + 1);
      const drawX = (dx + 1) * TILE_SIZE;
      const drawY = (dy + 1) * TILE_SIZE;
      ctx.drawImage(tiles[tileIdx], drawX, drawY);
    }
  }

  // Calculate pixel position of center on the composite canvas
  const centerPixelX = (fx - (centerTileX - 1)) * TILE_SIZE;
  const centerPixelY = (fy - (centerTileY - 1)) * TILE_SIZE;

  // Draw route polyline
  if (routePolyline.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let started = false;
    for (const point of routePolyline) {
      const { x: px, y: py } = latLngToTileXY(point.lat, point.lng, zoom);
      const pixX = (px - (centerTileX - 1)) * TILE_SIZE;
      const pixY = (py - (centerTileY - 1)) * TILE_SIZE;

      if (pixX >= -50 && pixX <= compositeSize + 50 && pixY >= -50 && pixY <= compositeSize + 50) {
        if (!started) {
          ctx.moveTo(pixX, pixY);
          started = true;
        } else {
          ctx.lineTo(pixX, pixY);
        }
      }
    }
    ctx.stroke();
  }

  // Now create the output canvas and rotate around the user's position
  // so that the bearing points UP (navigation-style heading-up view)
  const output = document.createElement('canvas');
  output.width = mapWidth;
  output.height = mapHeight;
  const outCtx = output.getContext('2d')!;

  // Black background (for corners after rotation)
  outCtx.fillStyle = '#0a0a0a';
  outCtx.fillRect(0, 0, mapWidth, mapHeight);

  // Position the user slightly below center so more of the route ahead is visible
  const userScreenX = mapWidth / 2;
  const userScreenY = mapHeight * 0.65;

  // Rotate: translate so user position is at the desired screen point,
  // rotate by negative bearing so heading faces up, then draw composite
  const rotRad = (-bearingDeg * Math.PI) / 180;

  outCtx.save();
  outCtx.translate(userScreenX, userScreenY);
  outCtx.rotate(rotRad);
  outCtx.translate(-centerPixelX, -centerPixelY);
  outCtx.drawImage(composite, 0, 0);
  outCtx.restore();

  // Draw navigation arrow at the user's screen position (always pointing up)
  drawNavigationArrow(outCtx, userScreenX, userScreenY);

  // Convert to greyscale
  const imageData = outCtx.getImageData(0, 0, mapWidth, mapHeight);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const level = Math.round((grey / 255) * 15);
    const value = level * 17;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  outCtx.putImageData(imageData, 0, 0);

  // Export as PNG
  const blob = await new Promise<Blob>((resolve, reject) => {
    output.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/png'
    );
  });
  const arrayBuf = await blob.arrayBuffer();
  return Array.from(new Uint8Array(arrayBuf));
}
