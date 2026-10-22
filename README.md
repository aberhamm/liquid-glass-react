# @aberhamm/liquid-glass-react

React glass components powered by the pinned
[`@samasante/liquid-glass`](https://github.com/samasante/liquid-glass) engine.
This package owns the composed controls and their styling; the optics engine is
maintained upstream. Matui imports this package rather than maintaining a second
copy of the components.

```sh
pnpm add @aberhamm/liquid-glass-react
```

```tsx
import {
  Glass, GlassButton, GlassCard, GlassSwitch, GlassSlider,
  GlassSegmentedControl, GlassNotification,
} from '@aberhamm/liquid-glass-react';
import '@aberhamm/liquid-glass-react/styles.css';

<Glass style={{ borderRadius: 28, padding: 24, background: '#ffffff33' }}
       optics={{ frost: 3, strength: 0.2, dispersion: 0.6 }}>
  A glass surface
</Glass>
<GlassButton>Save changes</GlassButton>
<GlassSwitch ariaLabel="Notifications" defaultChecked />
<GlassSlider ariaLabel="Volume" defaultValue={50} />
<GlassSegmentedControl label="Time range" defaultValue="week" options={[
  { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' },
]} />
<div style={{ height: 400 }}>
  <GlassNotification title="Matthew" avatar="MA" body="The glass collection is ready." />
</div>
```

React 18+ and React DOM are peers. Import the stylesheet once for the composed
controls. `Glass` and its alias `LiquidGlass` expose the upstream engine's props.
Switch, slider and segmented control support controlled state or initial defaults,
native keyboard controls, form values and disabled states. Switch and slider motion
honors `prefers-reduced-motion`. Give all controls accessible labels.

The switch, slider and notification adapt the MIT upstream examples at revision
`4e7b769e1df7e5a7d3669fef22417fe3d2f79ade`; attribution is preserved in source
and `licenses/samasante-liquid-glass-MIT.txt`. The pinned dependency is bundled
in the web builds to support both ESM and CommonJS without requiring consumers
to load an ESM-only dependency through `require()`.

## Browser behavior

Arbitrary live-backdrop refraction is Chromium-only. Safari and Firefox retain
frosted glass; use `refract` with a decorative copy for cross-browser bending.
The notification recipe aligns a wallpaper copy beneath its lens. Keep copies
free of controls, IDs, data fetching and effects. The upstream video/canvas mode
uses WebGL. Large or numerous lenses can affect frame rate.

## Migrating from 0.2.x

Version 0.3 replaces the previous custom **web** implementation and its API.
Replace `cornerRadius` and `padding` with CSS in `style`; replace the old optical
props (`displacement`, `displacementScale`, `blurAmount`, etc.) with upstream
`optics`. `LiquidGlass` is now an alias for `Glass`, not a legacy-prop adapter.
The previous web capability, displacement, backdrop-sampling and motion helper
exports have been removed. Button/card/segmented-control support the props shown
in the new Storybook; consult the generated types for the complete new API.
Old docs and plans under `docs/` describe 0.2.x and remain historical references.

ESM, CommonJS and `styles.css` package paths remain available. The separate
`react-native` export condition still resolves to the previous native frosted
primitive backed by Expo Blur and Linear Gradient. Its existing props remain
unchanged; the new web-only composed controls are not exported on native.

## Development

```sh
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:native
corepack pnpm build
corepack pnpm build-storybook
corepack pnpm exec playwright test
```

Storybook contains examples for the engine and all six composed controls.
`test/consumer-fixture` checks ESM/CommonJS exports after a build.
