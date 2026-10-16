import { vi } from 'vitest';

const get = vi.fn();
vi.mock('@/core/http', () => ({ http: { get: (...a: unknown[]) => get(...a) } }));

import { fetchLatestVersion, isUpdateAvailable } from '@/api/version';

beforeEach(() => get.mockReset());

describe('fetchLatestVersion', () => {
  it('reads version.json (with a cache-busting parameter)', async () => {
    get.mockResolvedValue({ data: { version: '0.1.5', build: 'abc-1', builtAt: '2026-10-16T10:00:00Z' } });
    await expect(fetchLatestVersion()).resolves.toEqual({ version: '0.1.5', build: 'abc-1', builtAt: '2026-10-16T10:00:00Z' });
    expect(get).toHaveBeenCalledWith('version.json', expect.objectContaining({ params: { t: expect.any(Number) } }));
  });

  it('is null when the server cannot be reached or the answer is not a version', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchLatestVersion()).resolves.toBeNull();
    get.mockResolvedValueOnce({ data: '<html>not found</html>' });
    await expect(fetchLatestVersion()).resolves.toBeNull();
    get.mockResolvedValueOnce({ data: { version: '0.1.5', build: '' } });
    await expect(fetchLatestVersion()).resolves.toBeNull();
  });
});

describe('isUpdateAvailable', () => {
  const latest = { version: '0.1.6', build: 'new', builtAt: '' };
  it('is true when the server has a different build', () => {
    expect(isUpdateAvailable('old', latest)).toBe(true);
  });

  it('is false for the same build, when nothing is known, and in the dev build', () => {
    expect(isUpdateAvailable('new', latest)).toBe(false);
    expect(isUpdateAvailable('old', null)).toBe(false);
    expect(isUpdateAvailable('old', undefined)).toBe(false);
    expect(isUpdateAvailable('dev', latest)).toBe(false);
  });
});
