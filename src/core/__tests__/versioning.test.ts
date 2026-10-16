// The version-number rule (CLAUDE.md): every way of deploying raises the version number in package.json first.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string; scripts: Record<string, string> };

describe('version number', () => {
  it('package.json has a semantic version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a script that raises it without tagging or committing anything', () => {
    expect(pkg.scripts['version:bump']).toBe('npm version patch --no-git-tag-version');
  });

  it.each(['deploy:test', 'deploy:live', 'deploy:ghpages'])('%s raises the version before it builds', (name) => {
    expect(pkg.scripts[name]).toMatch(/^npm run version:bump && npm run build && /);
  });
});
