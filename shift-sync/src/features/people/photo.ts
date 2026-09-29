import { PHOTO_MAX } from '../../core/core.generated.js';

/* A picked photo becomes a small square image (the middle of the picture, 160px a side) held as a data URL, because it is
 * stored on the person and synced into one Sheet cell. With `cutout`, the background is taken out first (cutout.ts, on the
 * device), so the person's own colour shows behind them. An opaque photo is a JPEG, its quality stepped down until it
 * fits the cell; one with see-through parts keeps them, as WebP or PNG, stepping the size down instead (a JPEG would fill
 * them in black). */
const WORK = 320;   // the cut-out runs on a larger square than is stored, for cleaner edges
const SIDES = [160, 128, 96];
const QUALITY = [0.85, 0.72, 0.6, 0.45];

export async function photoFromFile(file: Blob, { cutout = false } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('This browser can’t read that image. Try a JPEG or PNG.'));
      i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight, crop = Math.min(w, h);
    const work = square(Math.min(WORK, crop));
    work.ctx.drawImage(img, (w - crop) / 2, (h - crop) / 2, crop, crop, 0, 0, work.canvas.width, work.canvas.width);
    if (cutout) await (await import('./cutout.ts')).cutOut(work.canvas);

    const at = (side: number) => { const s = square(side); s.ctx.drawImage(work.canvas, 0, 0, side, side); return s; };
    const first = at(SIDES[0]!);
    if (!seeThrough(first.ctx, SIDES[0]!)) {
      for (const q of QUALITY) {
        const data = first.canvas.toDataURL('image/jpeg', q);
        if (data.length <= PHOTO_MAX) return data;
      }
    } else {
      for (const side of SIDES) {
        const { canvas } = side === SIDES[0] ? first : at(side);
        for (const q of QUALITY) {
          const data = canvas.toDataURL('image/webp', q);
          if (!data.startsWith('data:image/webp')) break;   // this browser can't write WebP; PNG below
          if (data.length <= PHOTO_MAX) return data;
        }
        const png = canvas.toDataURL('image/png');
        if (png.length <= PHOTO_MAX) return png;
      }
    }
    throw new Error('That photo is too detailed to store. Try another.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function square(side: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not resize the photo.');
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Whether any pixel is less than fully opaque. */
function seeThrough(ctx: CanvasRenderingContext2D, side: number): boolean {
  const px = ctx.getImageData(0, 0, side, side).data;
  for (let i = 3; i < px.length; i += 4) if (px[i]! < 250) return true;
  return false;
}
