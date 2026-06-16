// CJS consumer smoke. Resolves via exports["."].require (dist/index.cjs).
// Run after `pnpm build`:  node test/consumer-fixture/cjs.cjs
const assert = require('node:assert');
const pkg = require('@aberhamm/liquid-glass-react');

for (const name of [
  'LiquidGlass',
  'GlassButton',
  'GlassSegmentedControl',
  'useGlassCapabilities',
  'detectGlassCapabilities',
]) {
  assert.ok(pkg[name] != null, `expected ${name} to be exported`);
}

assert.equal(typeof pkg.VERSION, 'string', 'VERSION should be a string');

console.log('CJS consumer-fixture ok:', pkg.VERSION, typeof pkg.LiquidGlass);
