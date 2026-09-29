import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import loaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import binaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import modelUrl from '../../assets/selfie_segmenter.tflite?url';

/* Taking the background out of a photo of a person, on the device: nothing is uploaded. MediaPipe's selfie segmenter
 * (Apache-2.0, a 250 KB model) says how sure it is that each pixel is the person, and that becomes the pixel's opacity.
 * The runtime (about 12 MB) loads the first time a photo is picked, not with the app, and the service worker keeps it
 * after that; so the first cut-out needs a connection, and later ones work offline. */

let segmenter: Promise<ImageSegmenter> | null = null;

function load(): Promise<ImageSegmenter> {
  segmenter ??= import('@mediapipe/tasks-vision').then(({ ImageSegmenter }) =>
    ImageSegmenter.createFromOptions(
      { wasmLoaderPath: new URL(loaderUrl, location.href).href, wasmBinaryPath: new URL(binaryUrl, location.href).href },
      { baseOptions: { modelAssetPath: new URL(modelUrl, location.href).href, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false }
    ));
  segmenter.catch(() => { segmenter = null; });   // a failed load (offline, say) is tried again next time
  return segmenter;
}

/** Soft edges without a halo: fully clear below `lo` confidence, fully solid above `hi`, a smooth step between. */
const LO = 0.3, HI = 0.7;
const opacity = (c: number) => { const t = Math.min(1, Math.max(0, (c - LO) / (HI - LO))); return t * t * (3 - 2 * t); };

/** Makes everything in `canvas` that isn't the person see-through, in place. */
export async function cutOut(canvas: HTMLCanvasElement): Promise<void> {
  const seg = await load();
  const result = seg.segment(canvas);
  try {
    const mask = result.confidenceMasks?.[0];
    if (!mask) throw new Error('No person found in the photo.');
    const conf = mask.getAsFloat32Array(), mw = mask.width, mh = mask.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not edit the photo.');
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h), px = img.data;
    for (let y = 0; y < h; y++) {
      const my = Math.min(mh - 1, Math.floor((y * mh) / h));
      for (let x = 0; x < w; x++) {
        const c = conf[my * mw + Math.min(mw - 1, Math.floor((x * mw) / w))] ?? 0;
        const i = (y * w + x) * 4 + 3;
        px[i] = Math.round(px[i]! * opacity(c));
      }
    }
    ctx.putImageData(img, 0, 0);
  } finally {
    result.close();
  }
}
