// The browser tab icon: index.html links a favicon and the files exist in public/ (they are copied to the site root by the build).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const icons = [...html.matchAll(/<link\s+rel="icon"[^>]*\shref="([^"]+)"/g)].map((m) => m[1]!);

describe('favicon', () => {
  it('index.html links the .ico and a 32px png', () => {
    expect(icons).toEqual(['favicon.ico', 'favicon-32.png']);
  });

  it.each(icons)('%s exists in public/', (href) => {
    expect(existsSync(resolve(root, 'public', href))).toBe(true);
  });
});
