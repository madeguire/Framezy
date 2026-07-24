"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DEVICE_ID,
  IPHONE_DEVICES,
  buildFrameSvg,
  getDevice,
  getFinish,
  getFrameGeometry,
  type FrameGeometry,
  type IphoneDevice,
  type IphoneFinish,
} from "@/lib/iphone-devices";
import {
  detectIosChrome,
  type IosChromeDetection,
} from "@/lib/detect-ios-chrome";
import {
  enhanceImage2x,
  isLowResForScreen,
  type EnhanceProgress,
} from "@/lib/enhance-image";

/** Transparent padding around the device in the exported PNG */
const EXPORT_PAD = 48;
const EXPORT_SCALE = 2;

/**
 * Drop shadow controls are authored in ~1280px phone artboard space;
 * preview/export scale them.
 */
const FIGMA_SHADOW_PHONE_W = 1280;
/** Orb maps light direction to offsets up to this (Figma units). */
const SHADOW_OFFSET_MAX = 300;

type ShadowSettings = {
  offsetX: number;
  offsetY: number;
  blur: number;
  /** Hex, e.g. #000000 */
  color: string;
  /** 0–1 */
  opacity: number;
};

const DEFAULT_SHADOW: ShadowSettings = {
  offsetX: 200,
  offsetY: 200,
  blur: 250,
  color: "#000000",
  opacity: 0.3,
};

/** Preview stage only — never baked into export. */
const DEFAULT_PREVIEW_BG = "#d8dee8";

const PREVIEW_BG_PRESETS = [
  { id: "studio", label: "Studio", color: DEFAULT_PREVIEW_BG },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "slate", label: "Slate", color: "#9aa3b2" },
  { id: "ink", label: "Ink", color: "#0e1116" },
] as const;

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.length === 6
        ? raw
        : null;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToRgba(hex: string, opacity: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${Math.min(1, Math.max(0, opacity))})`;
  const a = Math.min(1, Math.max(0, opacity));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** Relative luminance — used so chrome text flips on dark preview backgrounds. */
function isDarkHex(hex: string): boolean {
  const rgb = parseHexRgb(hex);
  if (!rgb) return false;
  const lin = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L < 0.42;
}

function scaledDropShadow(frameW: number, settings: ShadowSettings) {
  const s = frameW / FIGMA_SHADOW_PHONE_W;
  return {
    offsetX: settings.offsetX * s,
    offsetY: settings.offsetY * s,
    blur: settings.blur * s,
    color: hexToRgba(settings.color, settings.opacity),
  };
}

function shadowSettingsEqual(a: ShadowSettings, b: ShadowSettings) {
  return (
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.blur === b.blur &&
    a.color === b.color &&
    a.opacity === b.opacity
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let dw: number;
  let dh: number;
  let dx: number;
  let dy: number;
  if (ir > tr) {
    dh = h;
    dw = h * ir;
    dx = x - (dw - w) / 2;
    dy = y;
  } else {
    dw = w;
    dh = w / ir;
    dx = x;
    dy = y - (dh - h) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Clip the phone canvas to the hard device silhouette (drops SVG AA fringe). */
function clipToDeviceSilhouette(
  ctx: CanvasRenderingContext2D,
  geo: FrameGeometry,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(geo.bodyX, geo.bodyY, geo.bodyW, geo.bodyH, geo.bodyR);
  const btnW = 6;
  const leftX = geo.sidePad - 6;
  ctx.roundRect(leftX, geo.bodyH * 0.2, btnW, geo.bodyH * 0.039, 2);
  ctx.roundRect(leftX, geo.bodyH * 0.26, btnW, geo.bodyH * 0.071, 2);
  ctx.roundRect(leftX, geo.bodyH * 0.35, btnW, geo.bodyH * 0.071, 2);
  ctx.roundRect(geo.bodyX + geo.bodyW, geo.bodyH * 0.3, btnW, geo.bodyH * 0.1, 2);
  ctx.fill();
  ctx.restore();
}

async function composeFramedPng(
  source: HTMLImageElement,
  geo: FrameGeometry,
  frameSrc: string,
  options: { includeShadow: boolean; shadow: ShadowSettings },
): Promise<Blob> {
  const frame = await loadImage(frameSrc);
  const shadow = scaledDropShadow(geo.frameW, options.shadow);

  // Compose the phone alone first so the drop shadow can wrap the full device
  const phoneCanvas = document.createElement("canvas");
  phoneCanvas.width = geo.frameW * EXPORT_SCALE;
  phoneCanvas.height = geo.frameH * EXPORT_SCALE;
  const phoneCtx = phoneCanvas.getContext("2d");
  if (!phoneCtx) throw new Error("Canvas unavailable");
  phoneCtx.scale(EXPORT_SCALE, EXPORT_SCALE);
  drawCover(
    phoneCtx,
    source,
    geo.screenX,
    geo.screenY,
    geo.screenW,
    geo.screenH,
    geo.screenR,
  );
  phoneCtx.drawImage(frame, 0, 0, geo.frameW, geo.frameH);
  clipToDeviceSilhouette(phoneCtx, geo);

  const padLeft = options.includeShadow
    ? EXPORT_PAD + Math.ceil(shadow.blur + Math.max(0, -shadow.offsetX))
    : EXPORT_PAD;
  const padRight = options.includeShadow
    ? EXPORT_PAD + Math.ceil(shadow.blur + Math.max(0, shadow.offsetX))
    : EXPORT_PAD;
  const padYTop = options.includeShadow
    ? EXPORT_PAD + Math.ceil(shadow.blur + Math.max(0, -shadow.offsetY))
    : EXPORT_PAD;
  const padYBottom = options.includeShadow
    ? EXPORT_PAD + Math.ceil(shadow.blur + Math.max(0, shadow.offsetY))
    : EXPORT_PAD;

  const canvas = document.createElement("canvas");
  canvas.width = (geo.frameW + padLeft + padRight) * EXPORT_SCALE;
  canvas.height = (geo.frameH + padYTop + padYBottom) * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const dx = padLeft * EXPORT_SCALE;
  const dy = padYTop * EXPORT_SCALE;

  if (options.includeShadow) {
    // Shadow from a hard silhouette so soft AA edges don’t lighten into side lines
    const sil = document.createElement("canvas");
    sil.width = phoneCanvas.width;
    sil.height = phoneCanvas.height;
    const silCtx = sil.getContext("2d");
    if (!silCtx) throw new Error("Canvas unavailable");
    silCtx.scale(EXPORT_SCALE, EXPORT_SCALE);
    silCtx.fillStyle = "#000";
    silCtx.beginPath();
    silCtx.roundRect(geo.bodyX, geo.bodyY, geo.bodyW, geo.bodyH, geo.bodyR);
    const btnW = 6;
    const leftX = geo.sidePad - 6;
    silCtx.roundRect(leftX, geo.bodyH * 0.2, btnW, geo.bodyH * 0.039, 2);
    silCtx.roundRect(leftX, geo.bodyH * 0.26, btnW, geo.bodyH * 0.071, 2);
    silCtx.roundRect(leftX, geo.bodyH * 0.35, btnW, geo.bodyH * 0.071, 2);
    silCtx.roundRect(geo.bodyX + geo.bodyW, geo.bodyH * 0.3, btnW, geo.bodyH * 0.1, 2);
    silCtx.fill();

    ctx.save();
    ctx.shadowOffsetX = shadow.offsetX * EXPORT_SCALE;
    ctx.shadowOffsetY = shadow.offsetY * EXPORT_SCALE;
    ctx.shadowBlur = shadow.blur * EXPORT_SCALE;
    ctx.shadowColor = shadow.color;
    ctx.drawImage(sil, dx, dy);
    ctx.restore();
    ctx.drawImage(phoneCanvas, dx, dy);
  } else {
    ctx.drawImage(phoneCanvas, dx, dy);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function IphoneFrameTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const originalUrlRef = useRef<string | null>(null);
  const trackedUrlsRef = useRef<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [finishId, setFinishId] = useState(() => getDevice(DEFAULT_DEVICE_ID).finishes[0].id);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [chrome, setChrome] = useState<IosChromeDetection | null>(null);
  /** null = follow detection; true/false = manual override */
  const [forceIsland, setForceIsland] = useState<boolean | null>(null);
  const [lowRes, setLowRes] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState<EnhanceProgress | null>(null);
  const [includeShadow, setIncludeShadow] = useState(true);
  const [shadow, setShadow] = useState<ShadowSettings>(DEFAULT_SHADOW);
  const [previewBg, setPreviewBg] = useState(DEFAULT_PREVIEW_BG);

  const device = useMemo(() => getDevice(deviceId), [deviceId]);
  const finish = useMemo(() => getFinish(device, finishId), [device, finishId]);
  const geo = useMemo(() => getFrameGeometry(device), [device]);
  const previewDark = isDarkHex(previewBg);

  const showIsland =
    forceIsland !== null ? forceIsland : !(chrome?.hideTemplateIsland ?? false);

  const frameUrl = useMemo(() => {
    const svg = buildFrameSvg(device, finish, { showIsland });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [device, finish, showIsland]);

  const trackUrl = useCallback((url: string) => {
    trackedUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeTracked = useCallback((url: string | null | undefined) => {
    if (!url || !trackedUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    trackedUrlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const urls = trackedUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!imageUrl) {
      setChrome(null);
      setLowRes(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(imageUrl);
        if (cancelled) return;
        setLowRes(isLowResForScreen(img, geo));
        const result = await detectIosChrome(img, geo);
        if (!cancelled) setChrome(result);
      } catch {
        if (!cancelled) {
          setChrome(null);
          setLowRes(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, geo]);

  const selectDevice = useCallback((next: IphoneDevice) => {
    setDeviceId(next.id);
    setFinishId((current) =>
      next.finishes.some((f) => f.id === current) ? current : next.finishes[0].id,
    );
  }, []);

  const resetImageState = useCallback(() => {
    setChrome(null);
    setForceIsland(null);
    setEnhanced(false);
    setEnhancing(false);
    setEnhanceProgress(null);
    setLowRes(false);
    originalUrlRef.current = null;
  }, []);

  const applyFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please use a PNG, JPG, or other image file.");
        return;
      }
      setError(null);
      setDownloaded(false);
      resetImageState();
      setImageUrl((prev) => {
        revokeTracked(prev);
        revokeTracked(originalUrlRef.current);
        originalUrlRef.current = null;
        return trackUrl(URL.createObjectURL(file));
      });
      setFileName(file.name.replace(/\.[^.]+$/, "") || "mock");
    },
    [resetImageState, revokeTracked, trackUrl],
  );

  const applyImageBlob = useCallback(
    (blob: Blob, name = "clipboard") => {
      if (!blob.type.startsWith("image/")) {
        setError("Clipboard doesn’t contain an image.");
        return;
      }
      const ext =
        blob.type === "image/jpeg"
          ? "jpg"
          : blob.type === "image/webp"
            ? "webp"
            : "png";
      applyFile(new File([blob], `${name}.${ext}`, { type: blob.type || "image/png" }));
    },
    [applyFile],
  );

  const pasteFromClipboard = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.clipboard?.read) {
        setError("Clipboard paste isn’t supported here — try ⌘V / Ctrl+V instead.");
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        applyImageBlob(await item.getType(type));
        return;
      }
      setError("No image found on the clipboard.");
    } catch {
      setError("Couldn’t read the clipboard. Use ⌘V / Ctrl+V, or allow clipboard access.");
    }
  }, [applyImageBlob]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) applyImageBlob(blob);
        return;
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyImageBlob]);

  const clearImage = useCallback(() => {
    setImageUrl((prev) => {
      revokeTracked(prev);
      revokeTracked(originalUrlRef.current);
      originalUrlRef.current = null;
      return null;
    });
    setFileName(null);
    setError(null);
    setDownloaded(false);
    resetImageState();
    if (inputRef.current) inputRef.current.value = "";
  }, [resetImageState, revokeTracked]);

  const onEnhance = useCallback(async () => {
    if (!imageUrl || enhancing) return;
    setEnhancing(true);
    setError(null);
    setEnhanceProgress({ progress: null, stage: "loading" });
    try {
      const img = await loadImage(imageUrl);
      const blob = await enhanceImage2x(img, setEnhanceProgress);
      const nextUrl = trackUrl(URL.createObjectURL(blob));
      if (!originalUrlRef.current) {
        originalUrlRef.current = imageUrl;
      } else if (imageUrl !== originalUrlRef.current) {
        revokeTracked(imageUrl);
      }
      setImageUrl(nextUrl);
      setEnhanced(true);
    } catch {
      setError("Couldn’t enhance the image. Try again, or use a larger source.");
    } finally {
      setEnhancing(false);
      setEnhanceProgress(null);
    }
  }, [imageUrl, enhancing, trackUrl, revokeTracked]);

  const onRevertEnhance = useCallback(() => {
    const original = originalUrlRef.current;
    if (!original) return;
    setImageUrl((prev) => {
      if (prev && prev !== original) revokeTracked(prev);
      return original;
    });
    setEnhanced(false);
  }, [revokeTracked]);

  const onDownload = useCallback(async () => {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const img = await loadImage(imageUrl);
      const blob = await composeFramedPng(img, geo, frameUrl, {
        includeShadow,
        shadow,
      });
      const name = [
        fileName || "mock",
        slugify(device.name),
        slugify(finish.name),
        "frame",
      ].join("-");
      downloadBlob(blob, `${name}.png`);
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 1600);
    } catch {
      setError("Couldn’t export the PNG. Try another image.");
    } finally {
      setBusy(false);
    }
  }, [imageUrl, fileName, geo, frameUrl, device.name, finish.name, includeShadow, shadow]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      applyFile(e.dataTransfer.files?.[0]);
    },
    [applyFile],
  );

  // 1.5× the original preview size (was capped at 320px wide)
  const previewWidth = Math.min(480, 960 * (geo.frameW / geo.frameH));
  const previewShadow = scaledDropShadow(geo.frameW, shadow);
  const previewScale = previewWidth / geo.frameW;
  const previewShadowCss = includeShadow
    ? `drop-shadow(${previewShadow.offsetX * previewScale}px ${previewShadow.offsetY * previewScale}px ${previewShadow.blur * previewScale}px ${previewShadow.color})`
    : undefined;

  return (
    <main
      className="studio-stage relative min-h-screen overflow-x-hidden"
      style={{ "--stage-bg": previewBg } as React.CSSProperties}
      data-dark={previewDark ? "true" : "false"}
    >
      {/* Device + source — left rail */}
      <section
        className={`enter-left relative z-20 mx-auto w-full max-w-sm px-5 pt-6 lg:absolute lg:left-6 lg:top-6 lg:mx-0 lg:w-[300px] lg:max-w-none lg:px-0 lg:pt-0 xl:left-8 ${entered ? "" : "opacity-0"}`}
      >
        <div className="panel flex flex-col gap-7 rounded-[20px] p-5">
          <header className="flex flex-col gap-2">
            <h1 className="brand-mark text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--ink)]">
              Framezy
            </h1>
            <p className="text-[13.5px] leading-snug text-[var(--ink-soft)]">
              Frame screenshots and mocks for decks, ads, and product reviews.
            </p>
          </header>

          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Model</span>
              <select
                value={device.id}
                onChange={(e) => selectDevice(getDevice(e.target.value))}
                className="field-select"
              >
                {IPHONE_DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="field-label">Finish</span>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {device.finishes.map((f) => (
                  <FinishSwatch
                    key={f.id}
                    finish={f}
                    selected={f.id === finish.id}
                    onSelect={() => setFinishId(f.id)}
                  />
                ))}
              </div>
              <p className="text-[13px] text-[var(--ink-soft)]">{finish.name}</p>
            </div>

            {imageUrl && (
              <div className="flex flex-col gap-1.5">
                <span className="field-label">Dynamic Island</span>
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={showIsland}
                    onChange={(e) => setForceIsland(e.target.checked)}
                    className="checkbox"
                  />
                  Show template island
                </label>
                {chrome?.hideTemplateIsland && forceIsland === null && (
                  <p className="pl-6 text-[12px] leading-snug text-[var(--ink-muted)]">
                    Detected existing{" "}
                    {[chrome.hasIsland && "Dynamic Island", chrome.hasStatusBar && "status bar"]
                      .filter(Boolean)
                      .join(" + ") || "system chrome"}
                    — template island hidden.
                  </p>
                )}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => applyFile(e.target.files?.[0])}
          />

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-primary w-full"
            >
              {imageUrl ? "Replace image" : "Choose image"}
            </button>

            <button
              type="button"
              onClick={pasteFromClipboard}
              className="btn-secondary w-full"
            >
              Paste from clipboard
            </button>

            {imageUrl && (
              <button
                type="button"
                onClick={clearImage}
                className="self-start px-0.5 py-1 text-[13px] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
              >
                Clear image
              </button>
            )}
          </div>

          <p className="text-[11.5px] leading-snug text-[var(--ink-muted)]">
            PNG or JPG · ⌘V / Ctrl+V · Export is 2× transparent PNG
          </p>
        </div>
      </section>

      {/* Export — right rail */}
      <section
        className={`enter-right relative z-20 mx-auto mt-4 w-full max-w-sm px-5 lg:absolute lg:right-6 lg:top-6 lg:mx-0 lg:mt-0 lg:w-[280px] lg:max-h-[calc(100vh-7.5rem)] lg:max-w-none lg:overflow-y-auto lg:px-0 xl:right-8 ${entered ? "" : "opacity-0"}`}
      >
        <div className="panel flex flex-col gap-5 rounded-[20px] p-5">
          <p className="field-label">Export</p>

          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={includeShadow}
              onChange={(e) => setIncludeShadow(e.target.checked)}
              className="checkbox"
            />
            Include drop shadow
          </label>

          <div
            className={`flex flex-col gap-5 transition-opacity ${
              includeShadow ? "opacity-100" : "pointer-events-none opacity-40"
            }`}
            aria-disabled={!includeShadow}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="field-label">Light source</span>
              {!shadowSettingsEqual(shadow, DEFAULT_SHADOW) && (
                <button
                  type="button"
                  onClick={() => setShadow(DEFAULT_SHADOW)}
                  className="cursor-pointer text-[12px] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                >
                  Reset
                </button>
              )}
            </div>

            <LightSourceOrb
              offsetX={shadow.offsetX}
              offsetY={shadow.offsetY}
              disabled={!includeShadow}
              onChange={(offsetX, offsetY) =>
                setShadow((prev) => ({ ...prev, offsetX, offsetY }))
              }
            />

            <p className="text-center font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
              X {Math.round(shadow.offsetX)} · Y {Math.round(shadow.offsetY)}
            </p>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="field-label">Blur</span>
                <span className="font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {Math.round(shadow.blur)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={400}
                step={1}
                value={shadow.blur}
                disabled={!includeShadow}
                onChange={(e) =>
                  setShadow((prev) => ({ ...prev, blur: Number(e.target.value) }))
                }
                className="field-range"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="field-label">Shadow color</span>
              <div className="flex items-center gap-2.5">
                <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[var(--line)]">
                  <span
                    className="absolute inset-0"
                    style={{ background: shadow.color }}
                    aria-hidden
                  />
                  <input
                    type="color"
                    value={shadow.color}
                    disabled={!includeShadow}
                    onChange={(e) =>
                      setShadow((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Shadow color"
                  />
                </label>
                <input
                  type="text"
                  value={shadow.color.toUpperCase()}
                  disabled={!includeShadow}
                  spellCheck={false}
                  onChange={(e) => {
                    const next = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(next)) {
                      setShadow((prev) => ({ ...prev, color: next.toLowerCase() }));
                    }
                  }}
                  className="field-input disabled:opacity-50"
                />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="field-label">Opacity</span>
                <span className="font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {Math.round(shadow.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(shadow.opacity * 100)}
                disabled={!includeShadow}
                onChange={(e) =>
                  setShadow((prev) => ({
                    ...prev,
                    opacity: Number(e.target.value) / 100,
                  }))
                }
                className="field-range"
              />
            </label>
          </div>

          {imageUrl && (
            <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5">
              {enhanced ? (
                <button
                  type="button"
                  onClick={onRevertEnhance}
                  disabled={enhancing}
                  className="btn-secondary w-full"
                >
                  Revert enhancement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onEnhance}
                  disabled={enhancing || busy}
                  className="btn-secondary w-full"
                >
                  {enhancing
                    ? enhanceProgress?.stage === "loading"
                      ? "Loading AI model…"
                      : `Enhancing… ${Math.round((enhanceProgress?.progress ?? 0) * 100)}%`
                    : "Enhance image (AI 2×)"}
                </button>
              )}
              {lowRes && !enhanced && !enhancing && (
                <p className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
                  This image looks low-res for the selected phone — AI upscaling can sharpen it before export.
                </p>
              )}
              {enhancing && enhanceProgress?.stage === "upscaling" && (
                <div
                  className="h-1 overflow-hidden rounded-full bg-[rgba(14,17,22,0.1)]"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                    style={{ width: `${Math.round((enhanceProgress.progress ?? 0) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!imageUrl || busy || enhancing}
            onClick={onDownload}
            className="btn-primary w-full"
          >
            {busy ? "Exporting…" : downloaded ? "Downloaded" : "Download PNG"}
          </button>

          {error && (
            <p className="text-[13px] text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Preview background — bottom-right */}
      <aside
        className={`enter-footer relative z-20 mx-auto mt-4 mb-8 w-full max-w-sm px-5 lg:absolute lg:right-6 lg:bottom-6 lg:mx-0 lg:mb-0 lg:mt-0 lg:w-auto lg:max-w-[260px] lg:px-0 xl:right-8 ${entered ? "" : "opacity-0"}`}
      >
        <div className="panel flex flex-col gap-2 rounded-2xl px-3.5 py-3">
          <span className="field-label">Preview background</span>
          <div className="flex flex-wrap items-center gap-2">
            {PREVIEW_BG_PRESETS.map((preset) => {
              const selected =
                previewBg.toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={selected}
                  onClick={() => setPreviewBg(preset.color)}
                  className="relative size-8 cursor-pointer rounded-lg transition-transform hover:scale-105"
                  style={{
                    background: preset.color,
                    boxShadow: selected
                      ? "0 0 0 2px #fff, 0 0 0 4px var(--accent)"
                      : "inset 0 0 0 1px rgba(0,0,0,0.14)",
                  }}
                />
              );
            })}
            <label
              className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg"
              title="Custom color"
              style={{
                background:
                  "conic-gradient(#f66, #fc0, #6f6, #0cf, #66f, #f6f, #f66)",
                boxShadow: PREVIEW_BG_PRESETS.every(
                  (p) => p.color.toLowerCase() !== previewBg.toLowerCase(),
                )
                  ? "0 0 0 2px #fff, 0 0 0 4px var(--accent)"
                  : undefined,
              }}
            >
              <span
                className="absolute inset-[3px] rounded-md"
                style={{ background: previewBg }}
                aria-hidden
              />
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(previewBg) ? previewBg : DEFAULT_PREVIEW_BG}
                onChange={(e) => setPreviewBg(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom preview background"
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-snug text-[var(--ink-muted)]">
            Preview only — not included in the export.
          </p>
        </div>
      </aside>

      {/* Stage — centered phone */}
      <section
        className={`enter-stage relative z-10 flex min-h-screen items-center justify-center px-6 py-28 lg:py-10 ${entered ? "" : "opacity-0"}`}
      >
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={onDrop}
          onClick={() => {
            if (!imageUrl) inputRef.current?.click();
          }}
          aria-label={imageUrl ? "Framed preview" : "Drop an image here or choose a file"}
          className="relative outline-none"
          style={{
            width: `min(100%, ${previewWidth}px, calc(86vh * ${geo.frameW / geo.frameH}))`,
            aspectRatio: `${geo.frameW} / ${geo.frameH}`,
            filter: previewShadowCss,
            transform: dragging ? "scale(1.015)" : "scale(1)",
            transition:
              "transform 360ms var(--ease-out), filter 200ms ease",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: imageUrl ? "scale(1)" : "scale(0.985)",
              transition: "transform 360ms var(--ease-out)",
            }}
          >
            <div
              className="absolute overflow-hidden bg-[#eceff3]"
              style={{
                left: `${(geo.screenX / geo.frameW) * 100}%`,
                top: `${(geo.screenY / geo.frameH) * 100}%`,
                width: `${(geo.screenW / geo.frameW) * 100}%`,
                height: `${(geo.screenH / geo.frameH) * 100}%`,
                borderRadius: `${(geo.screenR / geo.screenW) * 100}% / ${(geo.screenR / geo.screenH) * 100}%`,
              }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Uploaded mock"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div
                  className={`flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center transition-colors ${
                    dragging ? "bg-[var(--accent-soft)]" : "bg-[#eceff3]"
                  }`}
                >
                  <div
                    className={`rounded-2xl border border-dashed px-5 py-8 transition-colors ${
                      dragging
                        ? "border-[var(--accent)]"
                        : "border-[rgba(14,17,22,0.18)]"
                    }`}
                  >
                    <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                      Drop PNG or JPG
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                      or paste / click to choose
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frameUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FinishSwatch({
  finish,
  selected,
  onSelect,
}: {
  finish: IphoneFinish;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={finish.name}
      aria-label={finish.name}
      aria-pressed={selected}
      className="relative size-9 cursor-pointer rounded-full transition-transform hover:scale-105"
      style={{
        background: `linear-gradient(145deg, ${finish.metal} 0%, ${finish.metalDark} 100%)`,
        boxShadow: selected
          ? "0 0 0 2px #fff, 0 0 0 4px var(--accent)"
          : "inset 0 0 0 1px rgba(0,0,0,0.12)",
      }}
    />
  );
}

/**
 * Circular stage control: drag the light; shadow offsets move opposite.
 */
function LightSourceOrb({
  offsetX,
  offsetY,
  disabled,
  onChange,
}: {
  offsetX: number;
  offsetY: number;
  disabled?: boolean;
  onChange: (offsetX: number, offsetY: number) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const lightX = Math.max(-1, Math.min(1, -offsetX / SHADOW_OFFSET_MAX));
  const lightY = Math.max(-1, Math.min(1, -offsetY / SHADOW_OFFSET_MAX));
  const len = Math.hypot(lightX, lightY);
  const nx = len > 1 ? lightX / len : lightX;
  const ny = len > 1 ? lightY / len : lightY;

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.min(rect.width, rect.height) / 2 - 14;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius && dist > 0) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      const unitX = dx / radius;
      const unitY = dy / radius;
      onChange(
        Math.round(-unitX * SHADOW_OFFSET_MAX),
        Math.round(-unitY * SHADOW_OFFSET_MAX),
      );
    },
    [onChange],
  );

  const endDrag = useCallback((pointerId: number, target?: HTMLElement | null) => {
    if (activePointerId.current !== pointerId) return;
    activePointerId.current = null;
    setIsDragging(false);
    const el = target ?? padRef.current;
    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [isDragging]);

  const knobLeft = 50 + nx * 36;
  const knobTop = 50 + ny * 36;
  const castLeft = 50 - nx * 22;
  const castTop = 50 - ny * 22;

  return (
    <div
      ref={padRef}
      role="slider"
      aria-label="Shadow light source"
      aria-valuetext={`X ${Math.round(offsetX)}, Y ${Math.round(offsetY)}`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        const step = e.shiftKey ? 20 : 8;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(Math.min(SHADOW_OFFSET_MAX, offsetX + step), offsetY);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(Math.max(-SHADOW_OFFSET_MAX, offsetX - step), offsetY);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(offsetX, Math.min(SHADOW_OFFSET_MAX, offsetY + step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(offsetX, Math.max(-SHADOW_OFFSET_MAX, offsetY - step));
        }
      }}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        activePointerId.current = e.pointerId;
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        applyPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        applyPointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => endDrag(e.pointerId, e.currentTarget)}
      onPointerCancel={(e) => endDrag(e.pointerId, e.currentTarget)}
      onLostPointerCapture={() => {
        activePointerId.current = null;
        setIsDragging(false);
      }}
      className="relative mx-auto aspect-square w-[148px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #fff 0%, #e8edf4 48%, #c5cedb 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -8px 18px rgba(14,17,22,0.06)",
        cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[18%] bottom-[18%] w-px -translate-x-1/2 bg-[rgba(14,17,22,0.08)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-[18%] right-[18%] h-px -translate-y-1/2 bg-[rgba(14,17,22,0.08)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(14,17,22,0.2)]"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${castLeft}%`,
          top: `${castTop}%`,
          background: "radial-gradient(circle, rgba(14,17,22,0.16) 0%, rgba(14,17,22,0) 70%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${knobLeft}%`,
          top: `${knobTop}%`,
          background:
            "radial-gradient(circle at 35% 30%, #ffd2c4 0%, #ff704d 45%, #ff4f2e 78%, #d93a1c 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.4), 0 2px 8px rgba(255,79,46,0.35)",
        }}
        aria-hidden
      />
    </div>
  );
}
