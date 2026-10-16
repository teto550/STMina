import { vi } from 'vitest';
import { compressImage, cropRect, fitWithin, looksBroken, shrinkSteps, type Decoder } from '@/core/image';

const pixels = (width: number, height: number, colourOf: (row: number) => [number, number, number]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = colourOf(y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
};

describe('fitWithin / shrinkSteps', () => {
  it('keeps the proportions and never enlarges', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 480)).toEqual({ width: 480, height: 360 });
    expect(fitWithin({ width: 3000, height: 4000 }, 480)).toEqual({ width: 360, height: 480 });
    expect(fitWithin({ width: 200, height: 100 }, 480)).toEqual({ width: 200, height: 100 });
  });

  it('shrinks in halving steps and ends on the target', () => {
    const steps = shrinkSteps({ width: 4000, height: 3000 }, { width: 480, height: 360 });
    expect(steps.at(-1)).toEqual({ width: 480, height: 360 });
    expect(steps.length).toBeGreaterThan(2);
    let prev = { width: 4000, height: 3000 };
    for (const s of steps) {
      expect(s.width).toBeGreaterThanOrEqual(prev.width / 2 - 1);
      prev = s;
    }
  });

  it('is a single step when the photo is already small', () => {
    expect(shrinkSteps({ width: 600, height: 400 }, { width: 480, height: 320 })).toEqual([{ width: 480, height: 320 }]);
  });
});

describe('cropRect', () => {
  const size = { width: 1000, height: 800 };
  it('is the whole picture without a crop', () => {
    expect(cropRect(size)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('turns fractions into pixels', () => {
    expect(cropRect(size, { x: 0.25, y: 0.5, width: 0.5, height: 0.25 })).toEqual({ x: 250, y: 400, width: 500, height: 200 });
  });

  it('keeps a crop that spills over the edge inside the picture', () => {
    expect(cropRect(size, { x: 0.9, y: 0.9, width: 0.5, height: 0.5 })).toEqual({ x: 900, y: 720, width: 100, height: 80 });
    expect(cropRect(size, { x: -1, y: 2, width: 0, height: 0 }).width).toBe(1);
  });
});

describe('looksBroken', () => {
  it('accepts a normal picture', () => {
    expect(looksBroken(pixels(40, 40, () => [120, 90, 60]), 40, 40)).toBe(false);
  });

  it('flags an all-black picture', () => {
    expect(looksBroken(pixels(40, 40, () => [0, 0, 0]), 40, 40)).toBe(true);
  });

  it('flags a picture drawn only at the top, the rest black', () => {
    expect(looksBroken(pixels(40, 40, (row) => (row < 12 ? [150, 120, 90] : [0, 0, 0])), 40, 40)).toBe(true);
  });

  it('accepts a picture that is dark at the bottom but not entirely black', () => {
    expect(looksBroken(pixels(40, 40, (row) => (row < 36 ? [150, 120, 90] : [0, 0, 0])), 40, 40)).toBe(false);
  });
});

describe('compressImage', () => {
  const fakeCanvas = (data: Uint8ClampedArray) => {
    const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data }) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
    return ctx;
  };
  const decoder = (size = { width: 1200, height: 900 }): { fn: Decoder; release: ReturnType<typeof vi.fn> } => {
    const release = vi.fn();
    return { fn: async () => ({ image: {} as CanvasImageSource, size, release }), release };
  };
  afterEach(() => vi.restoreAllMocks());

  it('draws only the cropped part of the photo on the first step', async () => {
    const ctx = fakeCanvas(pixels(480, 480, () => [120, 90, 60]));
    await compressImage(new Blob(['x']), { crop: { x: 0.25, y: 0, width: 0.5, height: 1 }, decoders: [decoder({ width: 1200, height: 900 }).fn] });
    const first = ctx.drawImage.mock.calls[0]!;
    expect(first.slice(1, 5)).toEqual([300, 0, 600, 900]);
  });

  it('returns a JPEG data URL, paints a white background first and releases the decoded image', async () => {
    const ctx = fakeCanvas(pixels(480, 360, () => [120, 90, 60]));
    const d = decoder();
    await expect(compressImage(new Blob(['x']), { decoders: [d.fn] })).resolves.toBe('data:image/jpeg;base64,AAAA');
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(d.release).toHaveBeenCalled();
  });

  it('falls back to the next decoder when the first gives a black picture', async () => {
    const black = pixels(480, 360, () => [0, 0, 0]);
    const good = pixels(480, 360, () => [120, 90, 60]);
    const ctx = fakeCanvas(black);
    const second = vi.fn(async () => ({ image: {} as CanvasImageSource, size: { width: 1200, height: 900 }, release: () => undefined }));
    // the first decoder's picture is judged black, then the data read changes to a good one for the second
    ctx.getImageData = vi.fn().mockReturnValueOnce({ data: black }).mockReturnValue({ data: good });
    await expect(compressImage(new Blob(['x']), { decoders: [decoder().fn, second] })).resolves.toContain('data:image/jpeg');
    expect(second).toHaveBeenCalled();
  });

  it('rejects with photo-unreadable when every decoder fails or gives a black picture', async () => {
    fakeCanvas(pixels(480, 360, () => [0, 0, 0]));
    const failing: Decoder = async () => {
      throw new Error('nope');
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(compressImage(new Blob(['x']), { decoders: [failing, decoder().fn] })).rejects.toThrow('photo-unreadable');
  });
});
