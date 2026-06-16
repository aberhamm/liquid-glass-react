# Consumer fixture

A belt-and-suspenders smoke test of the **published** package surface, run
against the built `dist/` artifact (not `src/`).

- `esm.mjs` — imports named exports + a type from the package and uses them in a
  type-correct way (ESM resolution path: `exports["."].import`).
- `cjs.cjs` — `require()`s the package and references an export (CJS resolution
  path: `exports["."].require`).

These are exercised after `pnpm build` by:

```bash
node -e "import('./dist/index.mjs').then(m => console.log('ESM ok', typeof m.LiquidGlass))"
node -e "const m = require('./dist/index.cjs'); console.log('CJS ok', typeof m.LiquidGlass)"
```

and by `pnpm attw` (`@arethetypeswrong/cli`), which is the primary
ESM/CJS/types validator. The fixture files are intentionally **not** part of the
`src` tsconfig include and are **not** shipped (`files: ["dist"]`), so they never
affect `pnpm typecheck` or the published tarball.
