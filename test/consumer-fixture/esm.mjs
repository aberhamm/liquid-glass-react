// ESM consumer smoke. Resolves via exports["."].import (dist/index.mjs).
// Run after `pnpm build`:  node test/consumer-fixture/esm.mjs
import assert from 'node:assert';
import {
  GlassButton,
  GlassSegmentedControl,
  LiquidGlass,
  VERSION,
  detectGlassCapabilities,
  useGlassCapabilities,
} from '@aberhamm/liquid-glass-react';

for (const [name, value] of Object.entries({
  LiquidGlass,
  GlassButton,
  GlassSegmentedControl,
  useGlassCapabilities,
  detectGlassCapabilities,
})) {
  assert.ok(value != null, `expected ${name} to be exported`);
}

assert.equal(typeof VERSION, 'string', 'VERSION should be a string');

console.log('ESM consumer-fixture ok:', VERSION, typeof LiquidGlass);
