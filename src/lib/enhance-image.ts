import type { FrameGeometry } from "@/lib/iphone-devices";

export type EnhanceProgress = {
  /** 0–1 while upscaling patches; null while the model is loading */
  progress: number | null;
  stage: "loading" | "upscaling";
};

type UpscalerInstance = {
  upscale: (
    image: HTMLImageElement,
    options?: {
      output?: "base64" | "tensor" | "src";
      patchSize?: number;
      padding?: number;
      progress?: (percent: number) => void;
    },
  ) => Promise<string>;
  dispose?: () => void;
};

let upscalerPromise: Promise<UpscalerInstance> | null = null;

async function getUpscaler(): Promise<UpscalerInstance> {
  if (!upscalerPromise) {
    upscalerPromise = (async () => {
      const [{ default: Upscaler }, { default: x2 }] = await Promise.all([
        import("upscaler"),
        import("@upscalerjs/esrgan-slim/2x"),
      ]);
      return new Upscaler({ model: x2 }) as UpscalerInstance;
    })();
  }
  return upscalerPromise;
}

/** True when the image must be scaled up meaningfully to fill the device screen. */
export function isLowResForScreen(img: HTMLImageElement, geo: FrameGeometry): boolean {
  if (!img.naturalWidth || !img.naturalHeight) return false;
  const coverScale = Math.max(
    geo.screenW / img.naturalWidth,
    geo.screenH / img.naturalHeight,
  );
  return coverScale > 1.25;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * AI 2× upscale via UpscalerJS (ESRGAN Slim). Runs entirely in the browser.
 * First call downloads the model (~few MB) from a CDN.
 */
export async function enhanceImage2x(
  source: HTMLImageElement,
  onProgress?: (p: EnhanceProgress) => void,
): Promise<Blob> {
  onProgress?.({ progress: null, stage: "loading" });
  const upscaler = await getUpscaler();
  onProgress?.({ progress: 0, stage: "upscaling" });

  const result = await upscaler.upscale(source, {
    output: "base64",
    patchSize: 64,
    padding: 2,
    progress: (percent) => {
      onProgress?.({ progress: percent, stage: "upscaling" });
    },
  });

  return dataUrlToBlob(result.startsWith("data:") ? result : `data:image/png;base64,${result}`);
}
