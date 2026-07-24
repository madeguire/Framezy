export type IphoneFinish = {
  id: string;
  name: string;
  /** Primary chassis color */
  metal: string;
  /** Darker shade for buttons / gradient */
  metalDark: string;
  /** Edge highlight (rgba or hex) */
  highlight: string;
};

export type IphoneDevice = {
  id: string;
  name: string;
  /**
   * Active screen size in points (Apple portrait layout).
   * Chrome (black glass rim + metal lip) is added *outside* this.
   */
  bodyW: number;
  bodyH: number;
  /** Screen corner radius (pt) */
  bodyR: number;
  /** Visible metal lip outside the black glass (pt) */
  bezel: number;
  islandW: number;
  islandH: number;
  finishes: IphoneFinish[];
};

const SIDE_PAD = 14;

const FINISH = {
  blackTitanium: {
    id: "black-titanium",
    name: "Black Titanium",
    metal: "#3a3a3c",
    metalDark: "#1c1c1e",
    highlight: "rgba(255,255,255,0.16)",
  },
  whiteTitanium: {
    id: "white-titanium",
    name: "White Titanium",
    metal: "#f0ece4",
    metalDark: "#c9c3b8",
    highlight: "rgba(0,0,0,0.12)",
  },
  naturalTitanium: {
    id: "natural-titanium",
    name: "Natural Titanium",
    metal: "#c4bdb2",
    metalDark: "#8f877c",
    highlight: "rgba(255,255,255,0.28)",
  },
  desertTitanium: {
    id: "desert-titanium",
    name: "Desert Titanium",
    metal: "#c2a48a",
    metalDark: "#8f735c",
    highlight: "rgba(255,255,255,0.22)",
  },
  blueTitanium: {
    id: "blue-titanium",
    name: "Blue Titanium",
    metal: "#3e4f5f",
    metalDark: "#24313c",
    highlight: "rgba(255,255,255,0.18)",
  },
  black: {
    id: "black",
    name: "Black",
    metal: "#1c1c1e",
    metalDark: "#0b0b0c",
    highlight: "rgba(255,255,255,0.14)",
  },
  white: {
    id: "white",
    name: "White",
    metal: "#f5f5f7",
    metalDark: "#c7c7cc",
    highlight: "rgba(0,0,0,0.10)",
  },
  pink16: {
    id: "pink",
    name: "Pink",
    metal: "#f2b6d0",
    metalDark: "#c88aa5",
    highlight: "rgba(255,255,255,0.35)",
  },
  teal: {
    id: "teal",
    name: "Teal",
    metal: "#a8d4c8",
    metalDark: "#6f9e93",
    highlight: "rgba(255,255,255,0.35)",
  },
  ultramarine: {
    id: "ultramarine",
    name: "Ultramarine",
    metal: "#5b6fd6",
    metalDark: "#3648a0",
    highlight: "rgba(255,255,255,0.28)",
  },
  blue15: {
    id: "blue",
    name: "Blue",
    metal: "#d4e4f2",
    metalDark: "#8eabbf",
    highlight: "rgba(255,255,255,0.4)",
  },
  green15: {
    id: "green",
    name: "Green",
    metal: "#d6e3c7",
    metalDark: "#93a67e",
    highlight: "rgba(255,255,255,0.4)",
  },
  yellow15: {
    id: "yellow",
    name: "Yellow",
    metal: "#f7e48b",
    metalDark: "#c4ad4e",
    highlight: "rgba(255,255,255,0.45)",
  },
  pink15: {
    id: "pink",
    name: "Pink",
    metal: "#f7d5d7",
    metalDark: "#c49a9e",
    highlight: "rgba(255,255,255,0.4)",
  },
  // iPhone 17 Pro
  silver17: {
    id: "silver",
    name: "Silver",
    metal: "#e4e5e7",
    metalDark: "#a8aaae",
    highlight: "rgba(0,0,0,0.10)",
  },
  cosmicOrange: {
    id: "cosmic-orange",
    name: "Cosmic Orange",
    metal: "#e8874a",
    metalDark: "#b35a28",
    highlight: "rgba(255,255,255,0.30)",
  },
  deepBlue: {
    id: "deep-blue",
    name: "Deep Blue",
    metal: "#1e3a5f",
    metalDark: "#0f2238",
    highlight: "rgba(255,255,255,0.18)",
  },
  // iPhone 17
  lavender17: {
    id: "lavender",
    name: "Lavender",
    metal: "#d7cce8",
    metalDark: "#a394b8",
    highlight: "rgba(255,255,255,0.40)",
  },
  sage17: {
    id: "sage",
    name: "Sage",
    metal: "#c5d4c0",
    metalDark: "#8fa389",
    highlight: "rgba(255,255,255,0.40)",
  },
  mistBlue17: {
    id: "mist-blue",
    name: "Mist Blue",
    metal: "#c5d8e8",
    metalDark: "#8eabbf",
    highlight: "rgba(255,255,255,0.40)",
  },
  // iPhone Air
  skyBlueAir: {
    id: "sky-blue",
    name: "Sky Blue",
    metal: "#d5e4f0",
    metalDark: "#9bb0c2",
    highlight: "rgba(255,255,255,0.42)",
  },
  lightGoldAir: {
    id: "light-gold",
    name: "Light Gold",
    metal: "#e8dcc4",
    metalDark: "#b8a888",
    highlight: "rgba(255,255,255,0.38)",
  },
  cloudWhiteAir: {
    id: "cloud-white",
    name: "Cloud White",
    metal: "#f2f2f4",
    metalDark: "#c5c5ca",
    highlight: "rgba(0,0,0,0.10)",
  },
  spaceBlackAir: {
    id: "space-black",
    name: "Space Black",
    metal: "#2c2c2e",
    metalDark: "#111113",
    highlight: "rgba(255,255,255,0.16)",
  },
} as const satisfies Record<string, IphoneFinish>;

const PRO_17_FINISHES: IphoneFinish[] = [
  FINISH.cosmicOrange,
  FINISH.silver17,
  FINISH.deepBlue,
];

const ALUMINUM_17_FINISHES: IphoneFinish[] = [
  FINISH.black,
  FINISH.white,
  FINISH.lavender17,
  FINISH.sage17,
  FINISH.mistBlue17,
];

const AIR_FINISHES: IphoneFinish[] = [
  FINISH.spaceBlackAir,
  FINISH.cloudWhiteAir,
  FINISH.lightGoldAir,
  FINISH.skyBlueAir,
];

const PRO_16_FINISHES: IphoneFinish[] = [
  FINISH.blackTitanium,
  FINISH.whiteTitanium,
  FINISH.naturalTitanium,
  FINISH.desertTitanium,
];

const PRO_15_FINISHES: IphoneFinish[] = [
  FINISH.blackTitanium,
  FINISH.whiteTitanium,
  FINISH.naturalTitanium,
  FINISH.blueTitanium,
];

const ALUMINUM_16_FINISHES: IphoneFinish[] = [
  FINISH.black,
  FINISH.white,
  FINISH.pink16,
  FINISH.teal,
  FINISH.ultramarine,
];

const ALUMINUM_15_FINISHES: IphoneFinish[] = [
  FINISH.black,
  FINISH.blue15,
  FINISH.green15,
  FINISH.yellow15,
  FINISH.pink15,
];

export const IPHONE_DEVICES: IphoneDevice[] = [
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    bodyW: 402,
    bodyH: 874,
    bodyR: 62,
    bezel: 3,
    islandW: 126,
    islandH: 37,
    finishes: PRO_17_FINISHES,
  },
  {
    id: "iphone-17-pro-max",
    name: "iPhone 17 Pro Max",
    bodyW: 440,
    bodyH: 956,
    bodyR: 70,
    bezel: 3,
    islandW: 136,
    islandH: 40,
    finishes: PRO_17_FINISHES,
  },
  {
    id: "iphone-17",
    name: "iPhone 17",
    bodyW: 402,
    bodyH: 874,
    bodyR: 62,
    bezel: 3,
    islandW: 126,
    islandH: 37,
    finishes: ALUMINUM_17_FINISHES,
  },
  {
    id: "iphone-air",
    name: "iPhone Air",
    bodyW: 420,
    bodyH: 912,
    bodyR: 64,
    bezel: 3,
    islandW: 128,
    islandH: 37,
    finishes: AIR_FINISHES,
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    bodyW: 402,
    bodyH: 874,
    bodyR: 62,
    bezel: 3,
    islandW: 126,
    islandH: 37,
    finishes: PRO_16_FINISHES,
  },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    bodyW: 440,
    bodyH: 956,
    bodyR: 70,
    bezel: 3,
    islandW: 136,
    islandH: 40,
    finishes: PRO_16_FINISHES,
  },
  {
    id: "iphone-16",
    name: "iPhone 16",
    bodyW: 393,
    bodyH: 852,
    bodyR: 56,
    bezel: 3,
    islandW: 124,
    islandH: 37,
    finishes: ALUMINUM_16_FINISHES,
  },
  {
    id: "iphone-16-plus",
    name: "iPhone 16 Plus",
    bodyW: 430,
    bodyH: 932,
    bodyR: 62,
    bezel: 3,
    islandW: 130,
    islandH: 38,
    finishes: ALUMINUM_16_FINISHES,
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    bodyW: 393,
    bodyH: 852,
    bodyR: 56,
    bezel: 3,
    islandW: 124,
    islandH: 37,
    finishes: PRO_15_FINISHES,
  },
  {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    bodyW: 430,
    bodyH: 932,
    bodyR: 62,
    bezel: 3,
    islandW: 130,
    islandH: 38,
    finishes: PRO_15_FINISHES,
  },
  {
    id: "iphone-15",
    name: "iPhone 15",
    bodyW: 393,
    bodyH: 852,
    bodyR: 56,
    bezel: 3,
    islandW: 124,
    islandH: 37,
    finishes: ALUMINUM_15_FINISHES,
  },
  {
    id: "iphone-15-plus",
    name: "iPhone 15 Plus",
    bodyW: 430,
    bodyH: 932,
    bodyR: 62,
    bezel: 3,
    islandW: 130,
    islandH: 38,
    finishes: ALUMINUM_15_FINISHES,
  },
];

export const DEFAULT_DEVICE_ID = "iphone-17-pro";

/** Black glass/display rim between metal chassis and active screen (pt) */
const BLACK_BORDER = 9;

export type FrameGeometry = {
  sidePad: number;
  frameW: number;
  frameH: number;
  bodyX: number;
  bodyY: number;
  bodyW: number;
  bodyH: number;
  bodyR: number;
  /** Outer edge of the black display glass */
  glassX: number;
  glassY: number;
  glassW: number;
  glassH: number;
  glassR: number;
  /** Active screen cutout (inside the black border) */
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  screenR: number;
  islandX: number;
  islandY: number;
  islandW: number;
  islandH: number;
  islandR: number;
};

export function getDevice(id: string): IphoneDevice {
  return IPHONE_DEVICES.find((d) => d.id === id) ?? IPHONE_DEVICES[0];
}

export function getFinish(device: IphoneDevice, finishId: string): IphoneFinish {
  return device.finishes.find((f) => f.id === finishId) ?? device.finishes[0];
}

export function getFrameGeometry(device: IphoneDevice): FrameGeometry {
  const sidePad = SIDE_PAD;
  const metalLip = device.bezel;

  // Logical screen first (e.g. 402×874) — chrome grows outward from here
  const screenW = device.bodyW;
  const screenH = device.bodyH;
  const screenR = device.bodyR;

  const glassW = screenW + BLACK_BORDER * 2;
  const glassH = screenH + BLACK_BORDER * 2;
  const glassR = screenR + BLACK_BORDER;

  const bodyW = glassW + metalLip * 2;
  const bodyH = glassH + metalLip * 2;
  const bodyR = glassR + metalLip;

  const bodyX = sidePad;
  const bodyY = 0;
  const glassX = bodyX + metalLip;
  const glassY = bodyY + metalLip;
  const screenX = glassX + BLACK_BORDER;
  const screenY = glassY + BLACK_BORDER;

  const islandW = device.islandW;
  const islandH = device.islandH;
  const islandX = screenX + (screenW - islandW) / 2;
  const islandY = screenY + 8;
  const islandR = islandH / 2;

  return {
    sidePad,
    frameW: bodyW + sidePad * 2,
    frameH: bodyH,
    bodyX,
    bodyY,
    bodyW,
    bodyH,
    bodyR,
    glassX,
    glassY,
    glassW,
    glassH,
    glassR,
    screenX,
    screenY,
    screenW,
    screenH,
    screenR,
    islandX,
    islandY,
    islandW,
    islandH,
    islandR,
  };
}

export type FrameSvgOptions = {
  /** When false, omit Dynamic Island (screenshot already includes one) */
  showIsland?: boolean;
};

/** Build an SVG frame string for preview/export (transparent screen cutout). */
export function buildFrameSvg(
  device: IphoneDevice,
  finish: IphoneFinish,
  options: FrameSvgOptions = {},
): string {
  const showIsland = options.showIsland !== false;
  const g = getFrameGeometry(device);
  const metalMaskId = "metal-cut";
  const blackMaskId = "black-ring";
  const rimMaskId = "rim-only";

  const bx = g.bodyX;
  const by = g.bodyY;
  const bw = g.bodyW;
  const bh = g.bodyH;
  const br = g.bodyR;

  const metalLip = Math.max(1, g.glassX - bx);
  const lensCx = g.islandX + g.islandH * 0.52;
  const lensCy = g.islandY + g.islandH / 2;
  // Keep glass highlight soft — pure white edge strokes bake into export fringes
  const glassStroke = "rgba(255,255,255,0.08)";

  const islandSvg = showIsland
    ? `
  <!-- Dynamic Island + subtle TrueDepth lens -->
  <rect x="${g.islandX}" y="${g.islandY}" width="${g.islandW}" height="${g.islandH}" rx="${g.islandR}" fill="#000000"/>
  <circle cx="${lensCx}" cy="${lensCy}" r="${g.islandH * 0.30}" fill="#0a0b0d"/>
  <circle cx="${lensCx}" cy="${lensCy}" r="${g.islandH * 0.22}" fill="url(#lensGlass)"/>
  <circle cx="${lensCx}" cy="${lensCy}" r="${g.islandH * 0.22}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.55"/>
  <circle cx="${lensCx - g.islandH * 0.05}" cy="${lensCy - g.islandH * 0.06}" r="${g.islandH * 0.055}" fill="rgba(255,255,255,0.18)"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${g.frameW}" height="${g.frameH}" viewBox="0 0 ${g.frameW} ${g.frameH}" fill="none">
  <defs>
    <mask id="${metalMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.frameW}" height="${g.frameH}">
      <rect width="${g.frameW}" height="${g.frameH}" fill="white"/>
      <rect x="${g.glassX}" y="${g.glassY}" width="${g.glassW}" height="${g.glassH}" rx="${g.glassR}" fill="black"/>
    </mask>
    <mask id="${blackMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.frameW}" height="${g.frameH}">
      <rect x="${g.glassX}" y="${g.glassY}" width="${g.glassW}" height="${g.glassH}" rx="${g.glassR}" fill="white"/>
      <rect x="${g.screenX}" y="${g.screenY}" width="${g.screenW}" height="${g.screenH}" rx="${g.screenR}" fill="black"/>
    </mask>
    <mask id="${rimMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.frameW}" height="${g.frameH}">
      <rect width="${g.frameW}" height="${g.frameH}" fill="white"/>
      <rect x="${g.glassX}" y="${g.glassY}" width="${g.glassW}" height="${g.glassH}" rx="${g.glassR}" fill="black"/>
    </mask>
    <linearGradient id="metal" x1="${bx}" y1="${by}" x2="${bx + bw}" y2="${by + bh}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${finish.metal}"/>
      <stop offset="0.42" stop-color="${finish.metalDark}"/>
      <stop offset="1" stop-color="${finish.metal}"/>
    </linearGradient>
    <linearGradient id="buttonMetal" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="${finish.metal}"/>
      <stop offset="0.5" stop-color="${finish.metalDark}"/>
      <stop offset="1" stop-color="${finish.metal}"/>
    </linearGradient>
    <clipPath id="metalClip">
      <!-- Inset so edge light never paints into the outer AA fringe -->
      <rect x="${bx + 0.75}" y="${by + 0.75}" width="${bw - 1.5}" height="${bh - 1.5}" rx="${Math.max(0, br - 0.75)}"/>
    </clipPath>
    <linearGradient id="rimStroke" x1="${bx}" y1="${by}" x2="${bx + bw}" y2="${by + bh}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="0.22" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.78" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.09"/>
    </linearGradient>
    <linearGradient id="topSpecular" x1="0" y1="${by}" x2="0" y2="${by + metalLip + 2}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="lensGlass" cx="38%" cy="34%" r="70%">
      <stop stop-color="#2a3038" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#12151a"/>
      <stop offset="1" stop-color="#07080a"/>
    </radialGradient>
  </defs>

  <!-- Side buttons -->
  <rect x="${g.sidePad - 6}" y="${bh * 0.20}" width="6" height="${bh * 0.039}" rx="2" fill="url(#buttonMetal)"/>
  <rect x="${g.sidePad - 6}" y="${bh * 0.26}" width="6" height="${bh * 0.071}" rx="2" fill="url(#buttonMetal)"/>
  <rect x="${g.sidePad - 6}" y="${bh * 0.35}" width="6" height="${bh * 0.071}" rx="2" fill="url(#buttonMetal)"/>
  <rect x="${bx + bw}" y="${bh * 0.30}" width="6" height="${bh * 0.10}" rx="2" fill="url(#buttonMetal)"/>
  <!-- Metal chassis lip -->
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${br}" fill="url(#metal)" mask="url(#${metalMaskId})"/>

  <!-- Soft inset edge light only (no vertical side speculars — those became 1px white export lines) -->
  <g clip-path="url(#metalClip)" mask="url(#${rimMaskId})">
    <rect x="${bx + 1.1}" y="${by + 1.1}" width="${bw - 2.2}" height="${bh - 2.2}" rx="${Math.max(0, br - 1.1)}" stroke="url(#rimStroke)" stroke-width="0.75" fill="none"/>
    <path d="M ${bx + br * 0.75} ${by + metalLip * 0.5} L ${bx + bw - br * 0.75} ${by + metalLip * 0.5}" stroke="url(#topSpecular)" stroke-width="0.7" stroke-linecap="round"/>
  </g>

  <!-- Inner black display border -->
  <rect x="${g.glassX}" y="${g.glassY}" width="${g.glassW}" height="${g.glassH}" rx="${g.glassR}" fill="#050505" mask="url(#${blackMaskId})"/>
  <rect x="${g.glassX + 0.35}" y="${g.glassY + 0.35}" width="${g.glassW - 0.7}" height="${g.glassH - 0.7}" rx="${Math.max(0, g.glassR - 0.35)}" stroke="${glassStroke}" stroke-width="0.55" fill="none"/>
${islandSvg}
</svg>`;
}

