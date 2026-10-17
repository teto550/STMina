// The backend rule (CLAUDE.md, BACKEND ACCESS): only src/api/** (plus the two core files) may use the backend SDK.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

type Check = { violators: (root?: string) => string[]; compare: (now: string[], baseline: string[]) => { fresh: string[]; cleaned: string[] } };

const check = createRequire(import.meta.url)(resolve(process.cwd(), 'tools/check-backend-imports.cjs')) as Check;
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
const baseline = (JSON.parse(readFileSync(resolve(process.cwd(), 'tools/backend-imports-baseline.json'), 'utf8')) as { files: string[] }).files;

let root = '';

function put(rel: string, content: string) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'backend-boundary-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('backend boundary check', () => {
  it('lets src/api and the two core files use the backend', () => {
    put('src/api/things.ts', "import { getDocs } from 'firebase/firestore';\nimport { db } from '@/core/firebase';\n");
    put('src/core/firebase.ts', "import { initializeApp } from 'firebase/app';\n");
    put('src/core/firestore-helpers.ts', "import { doc } from 'firebase/firestore';\n");
    expect(check.violators(root)).toEqual([]);
  });

  it('finds every way of reaching the backend from outside', () => {
    put('src/react/screens/a/index.tsx', "import { getDocs } from 'firebase/firestore';\n");
    put('src/react/hooks/useB.ts', "import { db } from '@/core/firebase';\n");
    put('src/features/c.ts', "import { ts } from '@/core/firestore-helpers';\n");
    put('src/features/d.ts', "const m = await import('firebase/messaging');\n");
    put('src/core/e.ts', "import { db } from './firebase';\n");
    expect(check.violators(root)).toEqual(['src/core/e.ts', 'src/features/c.ts', 'src/features/d.ts', 'src/react/hooks/useB.ts', 'src/react/screens/a/index.tsx']);
  });

  it('ignores files that do not use the backend, and tests', () => {
    put('src/react/screens/a/index.tsx', "import { useThings } from '@/react/hooks/useThings';\n");
    put('src/react/__tests__/a.test.tsx', "import { getDocs } from 'firebase/firestore';\n");
    put('src/features/__tests__/b.ts', "import { db } from '@/core/firebase';\n");
    expect(check.violators(root)).toEqual([]);
  });

  it('flags a new violator and a baseline file that is clean now', () => {
    expect(check.compare(['src/a.ts', 'src/b.ts'], ['src/a.ts', 'src/c.ts'])).toEqual({ fresh: ['src/b.ts'], cleaned: ['src/c.ts'] });
    expect(check.compare(['src/a.ts'], ['src/a.ts'])).toEqual({ fresh: [], cleaned: [] });
  });
});

describe('backend boundary in this project', () => {
  it('has no violator outside the baseline, and the baseline has no clean file', () => {
    expect(check.compare(check.violators(), baseline)).toEqual({ fresh: [], cleaned: [] });
  });

  it('is part of the build', () => {
    expect(pkg.scripts['check:backend']).toBe('node tools/check-backend-imports.cjs');
    expect(pkg.scripts.build).toContain('npm run check:backend');
  });
});
