// Toolchain placeholder for tsconfig.native.json (plan 024).
//
// `tsconfig.native.json` includes `src/**/*.native.{ts,tsx}`, which matches
// zero files until plan 025 authors the React Native entry points. A `tsc -p`
// run with an empty input set fails with TS18003 ("No inputs were found"); this
// file guarantees at least one input so `pnpm typecheck:native` exits 0 cleanly
// in the meantime. It is intentionally inert and excluded from the web build.
export {};
