import type { Meta, StoryObj } from '@storybook/react';
import type { ReactElement } from 'react';
import { LiquidGlass } from './liquid-glass';
import type { DisplacementMode } from './types';

/**
 * `<LiquidGlass>` is the low-level primitive every prebuilt component wraps. The
 * stories below are the interactive documentation surface: the `Playground`
 * exposes every prop as a live control, `Modes` exercises all five displacement
 * algorithms side by side, and `Showcase` floats glass over an animated backdrop
 * so refraction edge-bending and cursor elasticity read clearly in Chromium (and
 * degrade cleanly elsewhere — see the CrossBrowser story).
 */
const meta = {
  title: 'Components/LiquidGlass',
  component: LiquidGlass,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The displacement/refraction primitive. Numeric controls below map 1:1 ' +
          'to the documented prop defaults; the visible effect requires a busy ' +
          'backdrop (every story is wrapped in one) and full refraction only ' +
          'renders in Chromium.',
      },
    },
  },
  argTypes: {
    children: {
      control: false,
      description: 'Content rendered inside the glass surface.',
      table: { category: 'Content' },
    },
    displacementScale: {
      control: { type: 'range', min: 0, max: 200, step: 1 },
      description:
        'Strength of the displacement/refraction distortion. Higher values bend ' +
        'the backdrop more aggressively.',
      table: { category: 'Refraction', defaultValue: { summary: '70' } },
    },
    blurAmount: {
      control: { type: 'range', min: 0, max: 20, step: 0.0625 },
      description: 'Backdrop blur radius in pixels applied behind the glass.',
      table: { category: 'Refraction', defaultValue: { summary: '0.0625' } },
    },
    saturation: {
      control: { type: 'range', min: 0, max: 300, step: 5 },
      description:
        'Backdrop saturation multiplier (1 = unchanged). Boosts color vibrancy of ' +
        'the content seen through the glass.',
      table: { category: 'Refraction', defaultValue: { summary: '140' } },
    },
    aberrationIntensity: {
      control: { type: 'range', min: 0, max: 20, step: 0.5 },
      description:
        'Intensity of the chromatic aberration (RGB channel separation) at the ' +
        'refracted edges. 0 disables it.',
      table: { category: 'Refraction', defaultValue: { summary: '2' } },
    },
    elasticity: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
      description:
        'How elastically the glass reacts to pointer movement. 0 is rigid; higher ' +
        'values produce a softer, more rubbery follow.',
      table: { category: 'Motion', defaultValue: { summary: '0.15' } },
    },
    cornerRadius: {
      control: { type: 'range', min: 0, max: 200, step: 1 },
      description:
        'Corner radius of the glass surface. A number is treated as pixels; a ' +
        'string is passed through as a CSS length (e.g. "1rem", "50%").',
      table: { category: 'Geometry', defaultValue: { summary: '999' } },
    },
    padding: {
      control: 'text',
      description:
        'Inner padding of the glass surface. A number is treated as pixels; a ' +
        'string is a CSS shorthand (e.g. "8px 16px").',
      table: { category: 'Geometry', defaultValue: { summary: "'24px'" } },
    },
    overLight: {
      control: 'boolean',
      description:
        'Hint that the glass sits over a light background, so it tunes its tint ' +
        'and contrast for legibility.',
      table: { category: 'Appearance', defaultValue: { summary: 'false' } },
    },
    mode: {
      control: 'select',
      options: ['standard', 'polar', 'prominent', 'shader', 'turbulence'],
      description:
        'Displacement algorithm: standard (balanced), polar (radial), prominent ' +
        '(exaggerated), shader (sharper highlights), turbulence (organic, watery).',
      table: { category: 'Refraction', defaultValue: { summary: "'standard'" } },
    },
    className: { control: false, table: { category: 'Escape hatches' } },
    style: { control: false, table: { category: 'Escape hatches' } },
    onClick: { control: false, action: 'click', table: { category: 'Events' } },
    // Motion props are controlled APIs for coordinating many surfaces from one
    // tracker; they are not useful as standalone controls, so hide them.
    globalMousePos: { control: false, table: { category: 'Controlled motion' } },
    mouseOffset: { control: false, table: { category: 'Controlled motion' } },
    mouseContainer: { control: false, table: { category: 'Controlled motion' } },
  },
  args: {
    displacementScale: 70,
    blurAmount: 0.0625,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0.15,
    cornerRadius: 32,
    padding: '24px 32px',
    overLight: false,
    mode: 'standard',
  },
} satisfies Meta<typeof LiquidGlass>;

export default meta;

type Story = StoryObj<typeof meta>;

const glassLabel = (text: string): ReactElement => (
  <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.01em' }}>
    {text}
  </span>
);

/**
 * Drive every prop from the controls panel. Move `displacementScale`,
 * `aberrationIntensity` and `elasticity` while hovering the surface to feel the
 * refraction and elastic follow.
 */
export const Playground: Story = {
  args: {
    children: glassLabel('Liquid Glass'),
  },
};

const MODES: readonly { mode: DisplacementMode; blurb: string }[] = [
  { mode: 'standard', blurb: 'Balanced edge-weighted displacement (default).' },
  { mode: 'polar', blurb: 'Radial displacement, stronger toward the perimeter.' },
  { mode: 'prominent', blurb: 'Exaggerated, heavier "thick glass" feel.' },
  { mode: 'shader', blurb: 'Shader-style profile for sharper highlights.' },
  { mode: 'turbulence', blurb: 'Fractal turbulence — organic, watery distortion.' },
];

/**
 * All five `DisplacementMode` values rendered together so the runtime-generated
 * `shader` map and the procedural `turbulence` (frosted-ripple) are visibly
 * exercised, not just reachable through the `mode` control.
 */
export const Modes: Story = {
  // `children` is required on LiquidGlassProps; this story renders its own glass
  // surfaces via `render`, so the meta-level arg is a placeholder.
  args: { children: null },
  parameters: {
    docs: {
      description: {
        story:
          'Side-by-side matrix of every displacement mode. Each tile shares the ' +
          'same geometry so only the distortion algorithm differs.',
      },
    },
  },
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '2rem',
        width: '100%',
        maxWidth: '64rem',
      }}
    >
      {MODES.map(({ mode, blurb }) => (
        <figure
          key={mode}
          style={{
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <LiquidGlass mode={mode} cornerRadius={28} padding="28px 36px">
            {glassLabel(mode)}
          </LiquidGlass>
          <figcaption
            style={{
              color: '#fff',
              fontSize: '0.8125rem',
              textAlign: 'center',
              maxWidth: '16rem',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            <strong style={{ textTransform: 'capitalize' }}>{mode}</strong>
            <br />
            {blurb}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * A deliberately designed showcase: a glass panel and pill floating over a rich,
 * slowly drifting gradient. The animation is pure CSS and is replaced with a
 * static backdrop under `prefers-reduced-motion: reduce`.
 */
export const Showcase: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    // Supplies its own full-bleed backdrop — opt out of the global gradient.
    noBackdrop: true,
    docs: {
      description: {
        story:
          'Glass floating over an animated gradient + soft orbs so refraction ' +
          'edge-bending and cursor elasticity are obvious. Honors ' +
          'prefers-reduced-motion by falling back to a static backdrop.',
      },
    },
  },
  render: () => (
    <div className="lg-showcase">
      <style>{SHOWCASE_CSS}</style>
      <div className="lg-showcase__orb lg-showcase__orb--a" />
      <div className="lg-showcase__orb lg-showcase__orb--b" />
      <div className="lg-showcase__orb lg-showcase__orb--c" />

      <div className="lg-showcase__stack">
        <LiquidGlass cornerRadius={28} padding="32px 36px" displacementScale={80} saturation={160}>
          <div style={{ color: '#fff', maxWidth: '22rem' }}>
            <p
              style={{
                margin: '0 0 0.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                opacity: 0.8,
              }}
            >
              Refraction, live
            </p>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', lineHeight: 1.2 }}>
              Light bends around the edges
            </h2>
            <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, opacity: 0.92 }}>
              Move your cursor across the panel to feel the elastic follow. The backdrop drifts
              beneath the glass so the displacement reads clearly.
            </p>
          </div>
        </LiquidGlass>

        <LiquidGlass cornerRadius={999} padding="14px 28px" displacementScale={60}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Get started</span>
        </LiquidGlass>
      </div>
    </div>
  ),
};

const SHOWCASE_CSS = `
.lg-showcase {
  position: relative;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
  background: linear-gradient(120deg, #6a11cb 0%, #2575fc 40%, #ff6a88 100%);
  background-size: 220% 220%;
  animation: lg-showcase-pan 18s ease-in-out infinite;
}
.lg-showcase__stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
}
.lg-showcase__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(8px);
  opacity: 0.8;
  mix-blend-mode: screen;
  will-change: transform;
}
.lg-showcase__orb--a {
  width: 28rem; height: 28rem; top: -8rem; left: -6rem;
  background: radial-gradient(circle, #ffd166 0%, transparent 70%);
  animation: lg-orb-a 22s ease-in-out infinite;
}
.lg-showcase__orb--b {
  width: 24rem; height: 24rem; bottom: -7rem; right: -5rem;
  background: radial-gradient(circle, #06d6a0 0%, transparent 70%);
  animation: lg-orb-b 26s ease-in-out infinite;
}
.lg-showcase__orb--c {
  width: 20rem; height: 20rem; top: 30%; right: 20%;
  background: radial-gradient(circle, #ef476f 0%, transparent 70%);
  animation: lg-orb-c 30s ease-in-out infinite;
}
@keyframes lg-showcase-pan {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes lg-orb-a {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(6rem, 4rem); }
}
@keyframes lg-orb-b {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-5rem, -3rem); }
}
@keyframes lg-orb-c {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-4rem, 5rem); }
}
@media (prefers-reduced-motion: reduce) {
  .lg-showcase,
  .lg-showcase__orb--a,
  .lg-showcase__orb--b,
  .lg-showcase__orb--c {
    animation: none;
  }
  .lg-showcase { background-position: 50% 50%; }
}
`;

/**
 * Cross-browser explainer. Mirrors `docs/PARITY.md`: Chromium gets full
 * refraction; Firefox and Safari/WebKit fall back to a frosted (non-refractive)
 * surface with identical geometry; engines without `backdrop-filter` get a solid
 * translucent surface. Same box, same content legibility — only the fill differs.
 */
export const CrossBrowser: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    docs: {
      description: {
        story:
          'What each engine actually renders, per docs/PARITY.md. The middle and ' +
          'right tiles SIMULATE the degraded fallbacks (your browser may render ' +
          'the left tile fully); they share identical geometry so degrading ' +
          'causes no layout shift.',
      },
    },
  },
  render: () => (
    <div className="lg-xb">
      <style>{CROSS_BROWSER_CSS}</style>
      <header className="lg-xb__head">
        <h2 style={{ margin: '0 0 0.5rem' }}>Cross-browser behavior</h2>
        <p style={{ margin: 0, maxWidth: '42rem', opacity: 0.9 }}>
          The single runtime gate is <code>canRefract</code> (
          <code>supportsBackdropFilter &amp;&amp; isChromium</code>). Non-Chromium engines
          intentionally receive a degraded, non-refractive surface rather than a broken or empty box
          — same dimensions, padding and radius, so there is no layout shift between tiers.
        </p>
      </header>

      <div className="lg-xb__grid">
        <figure className="lg-xb__cell">
          <LiquidGlass cornerRadius={24} padding="28px 32px" displacementScale={80}>
            {glassLabel('Full refraction')}
          </LiquidGlass>
          <figcaption>
            <strong>Tier 1 — Chromium</strong>
            <span>
              Chrome, Edge, Brave, Opera. SVG <code>feDisplacementMap</code> refraction composited
              over <code>backdrop-filter</code>, plus blur, saturation, chromatic aberration and
              elastic motion.
            </span>
          </figcaption>
        </figure>

        <figure className="lg-xb__cell">
          <div className="lg-xb__sim lg-xb__sim--frosted">{glassLabel('Frosted fallback')}</div>
          <figcaption>
            <strong>Tier 2 — Firefox &amp; Safari</strong>
            <span>
              <code>backdrop-filter: blur() saturate()</code> with no displacement map. Keeps the
              frosted blur, rim/bevel and motion — only the refraction is dropped.
            </span>
          </figcaption>
        </figure>

        <figure className="lg-xb__cell">
          <div className="lg-xb__sim lg-xb__sim--solid">{glassLabel('Solid fallback')}</div>
          <figcaption>
            <strong>Tier 3 — no backdrop-filter</strong>
            <span>
              Very old engines get a translucent <em>solid</em> fill (~0.55 alpha) so content stays
              legible — never a transparent, unreadable box.
            </span>
          </figcaption>
        </figure>
      </div>
    </div>
  ),
};

const CROSS_BROWSER_CSS = `
.lg-xb {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 3rem 1.5rem;
  color: #fff;
  background:
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%),
    linear-gradient(135deg, #1f2233 0%, #3b2d63 45%, #7a3b8f 100%);
  font-family: system-ui, sans-serif;
}
.lg-xb__head { max-width: 64rem; margin: 0 auto 2.5rem; }
.lg-xb code {
  background: rgba(255,255,255,0.12);
  padding: 0.05em 0.35em;
  border-radius: 4px;
  font-size: 0.85em;
}
.lg-xb__grid {
  max-width: 64rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2rem;
  align-items: start;
}
.lg-xb__cell {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.lg-xb__cell figcaption {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.45;
}
.lg-xb__cell figcaption strong { font-size: 0.95rem; }
.lg-xb__cell figcaption span { opacity: 0.88; }
.lg-xb__sim {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 12rem;
  min-height: 3.5rem;
  padding: 28px 32px;
  border-radius: 24px;
  box-sizing: border-box;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.4),
    inset 0 -1px 0 rgba(0,0,0,0.25),
    0 10px 30px rgba(0,0,0,0.18);
}
.lg-xb__sim--frosted {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
}
.lg-xb__sim--solid {
  background: rgba(40, 30, 70, 0.55);
}
`;
