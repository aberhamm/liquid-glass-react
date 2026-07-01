#!/usr/bin/env node
/**
 * Plan 026 — Expo/Metro consumer resolution verification.
 *
 * Proves that the package's `exports` map (the REAL published map in
 * package.json, exercised against the emitted `dist/` artifacts — not `src/`)
 * routes platform conditions the way an Expo/Metro consumer needs:
 *
 *   (a) resolving "." under the `react-native` condition lands on the NATIVE
 *       entry (`dist/native/index.native.js`), NOT the web entry;
 *   (b) resolving "." under default web conditions (`import`/`browser`) lands on
 *       the WEB entry (`dist/index.mjs`), NOT the native entry;
 *   (c) the web entry's transitive import graph references NO `expo-*` /
 *       `react-native` specifier, so a web bundle never pulls native peer deps.
 *
 * This is verification only — it changes no library code. Run it after
 * `pnpm build` so the resolved targets exist on disk. Exits non-zero on the
 * first failed assertion so it can gate CI.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolvePath(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolvePath(pkgRoot, 'package.json'), 'utf8'));

let failures = 0;
function assert(cond, message) {
  if (cond) {
    console.log(`  [ok] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    failures += 1;
  }
}

/**
 * Minimal implementation of Node's conditional `exports` resolution. Walks the
 * target for a subpath, selecting the first key that is `default` or a member of
 * the active condition set (insertion order, as Node specifies).
 */
function resolveConditions(target, conditions) {
  if (typeof target === 'string') return target;
  if (target && typeof target === 'object') {
    for (const key of Object.keys(target)) {
      if (key === 'default' || conditions.has(key)) {
        const resolved = resolveConditions(target[key], conditions);
        if (resolved != null) return resolved;
      }
    }
  }
  return null;
}

function resolveSubpath(subpath, conditionList) {
  const target = pkg.exports?.[subpath];
  if (target == null) throw new Error(`no exports entry for "${subpath}"`);
  return resolveConditions(target, new Set(conditionList));
}

// --- (a) react-native condition → native entry -----------------------------
console.log('[verify:expo] resolving "." under the react-native condition');
const nativeEntry = resolveSubpath('.', ['react-native', 'import', 'default']);
console.log(`  resolved: ${nativeEntry}`);
assert(
  typeof nativeEntry === 'string' && nativeEntry.includes('index.native'),
  `react-native condition resolves to the native entry (contains "index.native"): ${nativeEntry}`,
);
assert(
  existsSync(resolvePath(pkgRoot, nativeEntry)),
  `native entry exists on disk: ${nativeEntry}`,
);

// --- (b) web conditions → web entry, not native ----------------------------
console.log('[verify:expo] resolving "." under default web conditions (import/browser)');
const webEntry = resolveSubpath('.', ['import', 'browser', 'default']);
console.log(`  resolved: ${webEntry}`);
assert(
  typeof webEntry === 'string' && webEntry.endsWith('index.mjs'),
  `web condition resolves to the web ESM entry (dist/index.mjs): ${webEntry}`,
);
assert(
  typeof webEntry === 'string' && !webEntry.includes('native'),
  `web condition does NOT resolve to a native entry: ${webEntry}`,
);
// Sanity: the CJS require condition should land on the CJS build.
const requireEntry = resolveSubpath('.', ['require', 'default']);
assert(
  typeof requireEntry === 'string' && requireEntry.endsWith('index.cjs'),
  `require condition resolves to the CJS entry (dist/index.cjs): ${requireEntry}`,
);

// --- (c) web entry transitive imports contain no expo-/react-native --------
console.log('[verify:expo] scanning the web entry import graph for native specifiers');
const IMPORT_RE =
  /(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const NATIVE_SPECIFIER_RE = /^(expo-|react-native($|\/))/;

function collectSpecifiers(source) {
  const specs = new Set();
  IMPORT_RE.lastIndex = 0;
  for (let m = IMPORT_RE.exec(source); m !== null; m = IMPORT_RE.exec(source)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec) specs.add(spec);
  }
  return specs;
}

const webEntryAbs = resolvePath(pkgRoot, webEntry);
const visited = new Set();
const offenders = [];
function walk(fileAbs) {
  if (visited.has(fileAbs)) return;
  visited.add(fileAbs);
  if (!existsSync(fileAbs)) return;
  const source = readFileSync(fileAbs, 'utf8');
  for (const spec of collectSpecifiers(source)) {
    if (NATIVE_SPECIFIER_RE.test(spec)) {
      offenders.push({ file: fileAbs, spec });
      continue;
    }
    if (spec.startsWith('.')) {
      // Recurse into relative imports that live inside the built bundle.
      const base = resolvePath(dirname(fileAbs), spec);
      for (const cand of [
        base,
        `${base}.mjs`,
        `${base}.js`,
        `${base}/index.mjs`,
        `${base}/index.js`,
      ]) {
        if (existsSync(cand)) {
          walk(cand);
          break;
        }
      }
    }
  }
}
walk(webEntryAbs);
assert(
  offenders.length === 0,
  `web entry import graph is free of expo-/react-native specifiers${
    offenders.length ? `: ${offenders.map((o) => o.spec).join(', ')}` : ''
  }`,
);

console.log('');
if (failures > 0) {
  console.error(`[verify:expo] FAILED with ${failures} assertion failure(s).`);
  process.exit(1);
}
console.log('[verify:expo] resolution checks passed.');
console.log(`[verify:expo] react-native condition → ${nativeEntry}`);
