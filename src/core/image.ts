// Turns a photo chosen from the camera or the gallery into a small JPEG data URL (what is stored on the kid).
//
// Phone photos are big (12 MP and more). Decoding them the cheap way (FileReader -> base64 data URL -> <img> -> one big drawImage)
// makes some phones (mostly iPhones and some Androids, mostly for photos straight from the camera) return an all-black canvas, or
// one that is only drawn on the top, without any error. So this module:
//   * decodes from the file itself (createImageBitmap / an object URL), never through a base64 string,
//   * lets the browser apply the EXIF rotation,
//   * paints a white background first (a transparent PNG/WebP would turn black in a JPEG),
//   * shrinks in halving steps instead of one huge jump,
//   * LOOKS at the result and, if it is black or cut off, tries the other decoder before giving up with a clear error.

export const PHOTO_MAX_SIZE = 480;
export const PHOTO_QUALITY = 0.7;

export type Size = { width: number; height: number };

/** The part of the picture to keep, as fractions (0..1) of its width and height, so it does not depend on how big the picture is shown. */
export type CropFraction = { x: number; y: number; width: number; height: number };

export type CompressOptions = {
  maxSize?: number;
  quality?: number;
  /** keep only this part of the picture (the crop popup) */
  crop?: CropFraction;
  decoders?: Decoder[];
};

/** The pixel rectangle of a crop inside a picture of `size` (kept inside the picture, at least 1 pixel). */
export function cropRect(size: Size, crop?: CropFraction): { x: number; y: number; width: number; height: number } {
  if (!crop) {
    return { x: 0, y: 0, width: size.width, height: size.height };
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x = Math.min(size.width - 1, Math.round(clamp(crop.x) * size.width));
  const y = Math.min(size.height - 1, Math.round(clamp(crop.y) * size.height));
  const width = Math.max(1, Math.min(size.width - x, Math.round(clamp(crop.width) * size.width)));
  const height = Math.max(1, Math.min(size.height - y, Math.round(clamp(crop.height) * size.height)));
  return { x, y, width, height };
}

/** The size that fits inside `max` x `max` and keeps the proportions (never enlarges). */
export function fitWithin({ width, height }: Size, max: number): Size {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The sizes to go through from `from` down to `to`: each step at most halves, so the browser never scales by a huge factor at once. */
export function shrinkSteps(from: Size, to: Size): Size[] {
  const steps: Size[] = [];
  let cur = from;
  while (cur.width / 2 > to.width && cur.height / 2 > to.height) {
    cur = { width: Math.round(cur.width / 2), height: Math.round(cur.height / 2) };
    steps.push(cur);
  }
  steps.push(to);
  return steps;
}

const isBlackRow = (data: Uint8ClampedArray, width: number, row: number): boolean => {
  for (let x = 0; x < width; x += 4) {
    const i = (row * width + x) * 4;
    if (data[i]! > 8 || data[i + 1]! > 8 || data[i + 2]! > 8) {
      return false;
    }
  }
  return true;
};

/**
 * True when the pixels look like a failed decode: the whole picture is black, or the last fifth is black while the top is not
 * (a picture that was only partly drawn). A real photo is almost never black along a whole fifth of its height.
 */
export function looksBroken(data: Uint8ClampedArray, width: number, height: number): boolean {
  const sample = Math.max(1, Math.floor(height / 40));
  let blackRows = 0;
  let total = 0;
  const bottomStart = Math.floor(height * 0.8);
  let bottomBlack = true;
  let topHasContent = false;
  for (let row = 0; row < height; row += sample) {
    total += 1;
    const black = isBlackRow(data, width, row);
    if (black) {
      blackRows += 1;
    } else if (row < bottomStart) {
      topHasContent = true;
    }
    if (row >= bottomStart && !black) {
      bottomBlack = false;
    }
  }
  if (blackRows === total) {
    return true;
  }
  return topHasContent && bottomBlack;
}

type Source = { image: CanvasImageSource; size: Size; release: () => void };
export type Decoder = (file: Blob) => Promise<Source>;

const decodeBitmap: Decoder = async (file) => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('no-bitmap');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  return { image: bitmap, size: { width: bitmap.width, height: bitmap.height }, release: () => bitmap.close() };
};

const decodeImageElement: Decoder = async (file) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img-load-failed'));
    });
  }
  return { image: img, size: { width: img.naturalWidth, height: img.naturalHeight }, release: () => URL.revokeObjectURL(url) };
};

const newCanvas = (size: Size): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
};

/** Paints the wanted part of the source on a white background in halving steps and returns the final canvas. */
function paint(source: Source, maxSize: number, crop?: CropFraction): HTMLCanvasElement {
  const rect = cropRect(source.size, crop);
  const target = fitWithin({ width: rect.width, height: rect.height }, maxSize);
  let from: CanvasImageSource = source.image;
  let canvas = newCanvas(target);
  let first = true;
  for (const step of shrinkSteps({ width: rect.width, height: rect.height }, target)) {
    canvas = newCanvas(step);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('no-canvas');
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, step.width, step.height);
    if (first) {
      ctx.drawImage(from, rect.x, rect.y, rect.width, rect.height, 0, 0, step.width, step.height);
      first = false;
    } else {
      ctx.drawImage(from, 0, 0, step.width, step.height);
    }
    from = canvas;
  }
  return canvas;
}

/**
 * A small JPEG data URL of the photo (longest side at most `maxSize`), optionally cropped first.
 * Rejects with `photo-unreadable` when no decoder gives a good picture.
 */
export async function compressImage(file: Blob, options: CompressOptions = {}): Promise<string> {
  const { maxSize = PHOTO_MAX_SIZE, quality = PHOTO_QUALITY, crop, decoders = [decodeBitmap, decodeImageElement] } = options;
  for (const decode of decoders) {
    let source: Source | null = null;
    try {
      source = await decode(file);
      if (!source.size.width || !source.size.height) {
        continue;
      }
      const canvas = paint(source, maxSize, crop);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const url = canvas.toDataURL('image/jpeg', quality);
      if (!looksBroken(pixels, canvas.width, canvas.height) && url.startsWith('data:image/jpeg')) {
        return url;
      }
    } catch (e) {
      console.warn('photo decoder failed, trying the next one:', e);
    } finally {
      source?.release();
    }
  }
  throw new Error('photo-unreadable');
}
