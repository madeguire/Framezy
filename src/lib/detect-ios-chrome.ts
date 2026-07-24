import type { FrameGeometry } from "@/lib/iphone-devices";

export type IosChromeDetection = {
  hasIsland: boolean;
  hasStatusBar: boolean;
  /** Hide template Dynamic Island when the screenshot already includes one */
  hideTemplateIsland: boolean;
};

type CoverMap = {
  dw: number;
  dh: number;
  dx: number;
  dy: number;
  imgW: number;
  imgH: number;
};

function coverMap(imgW: number, imgH: number, screenW: number, screenH: number): CoverMap {
  const ir = imgW / imgH;
  const tr = screenW / screenH;
  let dw: number;
  let dh: number;
  let dx: number;
  let dy: number;
  if (ir > tr) {
    dh = screenH;
    dw = screenH * ir;
    dx = -(dw - screenW) / 2;
    dy = 0;
  } else {
    dw = screenW;
    dh = screenW / ir;
    dx = 0;
    dy = -(dh - screenH) / 2;
  }
  return { dw, dh, dx, dy, imgW, imgH };
}

function screenToImage(map: CoverMap, sx: number, sy: number) {
  return {
    x: ((sx - map.dx) * map.imgW) / map.dw,
    y: ((sy - map.dy) * map.imgH) / map.dh,
  };
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function inPill(
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  const rx = w / 2;
  const ry = h / 2;
  // Stadium / pill: rectangle with semicircle caps
  const inner = rx - ry;
  if (Math.abs(py - cy) > ry) return false;
  if (Math.abs(px - cx) <= inner) return true;
  const capX = px < cx ? cx - inner : cx + inner;
  const dx = px - capX;
  const dy = py - cy;
  return (dx * dx) / (ry * ry) + (dy * dy) / (ry * ry) <= 1;
}

function sampleRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step = 2,
) {
  let count = 0;
  let dark = 0;
  let sum = 0;
  let sumSq = 0;

  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(width - 1, Math.ceil(x1));
  const bottom = Math.min(height - 1, Math.ceil(y1));

  for (let y = top; y <= bottom; y += step) {
    for (let x = left; x <= right; x += step) {
      const i = (y * width + x) * 4;
      const L = luminance(data[i], data[i + 1], data[i + 2]);
      count += 1;
      sum += L;
      sumSq += L * L;
      if (L < 42) dark += 1;
    }
  }

  if (count === 0) {
    return { count: 0, darkRatio: 0, mean: 0, variance: 0 };
  }
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return { count, darkRatio: dark / count, mean, variance };
}

/**
 * Heuristic: look for a dark Dynamic Island pill + status-bar content
 * in the top of a screenshot (mapped with the same object-fit: cover as the preview).
 */
export async function detectIosChrome(
  source: HTMLImageElement,
  geo: FrameGeometry,
): Promise<IosChromeDetection> {
  const analyzeW = Math.min(402, source.naturalWidth);
  const scale = analyzeW / source.naturalWidth;
  const analyzeH = Math.max(1, Math.round(source.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = analyzeW;
  canvas.height = analyzeH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { hasIsland: false, hasStatusBar: false, hideTemplateIsland: false };
  }

  ctx.drawImage(source, 0, 0, analyzeW, analyzeH);
  const { data } = ctx.getImageData(0, 0, analyzeW, analyzeH);

  // Work in logical screen space, then map into the analyzed bitmap via cover-fit
  const map = coverMap(analyzeW, analyzeH, geo.screenW, geo.screenH);
  const toBmp = (sx: number, sy: number) => {
    const p = screenToImage(map, sx, sy);
    return { x: p.x, y: p.y };
  };

  // Island in screen-local coords (relative to screen origin)
  const islandLocalX = geo.islandX - geo.screenX;
  const islandLocalY = geo.islandY - geo.screenY;
  const islandCx = islandLocalX + geo.islandW / 2;
  const islandCy = islandLocalY + geo.islandH / 2;

  // Sample inside the pill
  let pillCount = 0;
  let pillDark = 0;
  let pillSum = 0;
  const stepSx = Math.max(1, geo.islandW / 28);
  const stepSy = Math.max(1, geo.islandH / 12);
  for (let sy = islandLocalY; sy <= islandLocalY + geo.islandH; sy += stepSy) {
    for (let sx = islandLocalX; sx <= islandLocalX + geo.islandW; sx += stepSx) {
      if (!inPill(sx, sy, islandCx, islandCy, geo.islandW, geo.islandH)) continue;
      const { x, y } = toBmp(sx, sy);
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= analyzeW || iy >= analyzeH) continue;
      const i = (iy * analyzeW + ix) * 4;
      const L = luminance(data[i], data[i + 1], data[i + 2]);
      pillCount += 1;
      pillSum += L;
      if (L < 42) pillDark += 1;
    }
  }

  const pillDarkRatio = pillCount ? pillDark / pillCount : 0;
  const pillMean = pillCount ? pillSum / pillCount : 255;

  // Ring just outside the pill — should be brighter on a real screenshot with island
  const pad = Math.max(4, geo.islandH * 0.55);
  const around = (() => {
    const tl = toBmp(islandLocalX - pad, islandLocalY - pad);
    const br = toBmp(
      islandLocalX + geo.islandW + pad,
      islandLocalY + geo.islandH + pad,
    );
    return sampleRegion(data, analyzeW, analyzeH, tl.x, tl.y, br.x, br.y, 3);
  })();

  // Exclude the pill itself roughly by requiring surround mean much higher
  const hasIsland =
    pillCount > 20 &&
    pillDarkRatio >= 0.72 &&
    pillMean < 36 &&
    around.mean - pillMean > 28;

  // Status bar band (time left / icons right), excluding island center
  const statusH = Math.min(54, geo.screenH * 0.07);
  const left = (() => {
    const tl = toBmp(12, 4);
    const br = toBmp(geo.screenW * 0.28, statusH);
    return sampleRegion(data, analyzeW, analyzeH, tl.x, tl.y, br.x, br.y, 2);
  })();
  const right = (() => {
    const tl = toBmp(geo.screenW * 0.72, 4);
    const br = toBmp(geo.screenW - 12, statusH);
    return sampleRegion(data, analyzeW, analyzeH, tl.x, tl.y, br.x, br.y, 2);
  })();

  // Status content usually has some contrast (glyphs) rather than a flat fill
  const hasStatusBar =
    (left.variance > 180 && left.count > 30) ||
    (right.variance > 180 && right.count > 30) ||
    (hasIsland && (left.variance > 80 || right.variance > 80));

  return {
    hasIsland,
    hasStatusBar,
    hideTemplateIsland: hasIsland || (hasStatusBar && pillDarkRatio >= 0.55 && pillMean < 50),
  };
}
