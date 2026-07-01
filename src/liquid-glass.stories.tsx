import type { Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useCallback, useRef, useState } from 'react';
import { LiquidGlass } from './liquid-glass';
import { PhotosAppBackdrop, SANS_FONT, photoTileBackground } from './photos-app-backdrop';
import type { DisplacementMode, LiquidGlassProps, MousePos } from './types';
import { useGlassCapabilities } from './use-glass-capabilities';

/**
 * `<LiquidGlass>` is the low-level primitive every prebuilt component wraps. The
 * DEFAULT surface is the portable frosted recipe (white tint + blur + saturate +
 * hairline ring + bevel) that renders in every engine; live SVG refraction is an
 * OPT-IN enhancement behind the `displacement` prop (off by default, Chromium
 * only). The stories below are the interactive documentation surface: the
 * `Playground` exposes every prop as a live control (including the `displacement`
 * toggle), `FrostedVsDisplacement` puts the default frosted look next to the
 * opt-in refraction over the SAME backdrop, `PortableHighlights` isolates the
 * specular/sheen/rim/bevel that render identically everywhere, `Modes` exercises
 * all five displacement algorithms, `Showcase` floats glass over a calm Photos
 * app, and the `Draggable` / `ScrollUnderGlass` / `CheapVsReal` stories let the
 * viewer SEE the opt-in refraction by moving content under the glass. Refraction
 * renders in Chromium and degrades cleanly elsewhere — see the CrossBrowser
 * story. The shared backdrop is an Apple-Photos-style surface built from
 * same-origin CSS scenic-gradient tiles (see `./photos-app-backdrop`).
 */
const meta = {
  title: 'Components/LiquidGlass',
  component: LiquidGlass,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The glass primitive. It renders the portable frosted recipe by DEFAULT ' +
          '(every engine); the live SVG refraction is opt-in via `displacement` ' +
          '(off by default, Chromium only). Numeric controls below map 1:1 to the ' +
          'documented prop defaults; the visible effect requires a busy backdrop ' +
          '(every story is wrapped in one) and refraction only renders in Chromium.',
      },
    },
  },
  argTypes: {
    children: {
      control: false,
      description: 'Content rendered inside the glass surface.',
      table: { category: 'Content' },
    },
    displacement: {
      control: 'boolean',
      description:
        'Opt into the live SVG refraction/displacement pass (web-only, Chromium). ' +
        'When false (the default) the glass renders the portable frosted recipe ' +
        'with no feDisplacementMap; when true and the browser can refract, the SVG ' +
        'displacement filter is attached.',
      table: { category: 'Refraction', defaultValue: { summary: 'false' } },
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
    variant: {
      control: 'inline-radio',
      options: ['regular', 'clear'],
      description:
        'Material variant. "regular" (default) is the fully adaptive control ' +
        'surface; "clear" is permanently more transparent for media-rich ' +
        'contexts and is non-adaptive (adaptiveTint is a no-op), with a dimming ' +
        'scrim for legibility. The two should never be mixed.',
      table: { category: 'Appearance', defaultValue: { summary: "'regular'" } },
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
    displacement: false,
    displacementScale: 70,
    blurAmount: 0.0625,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0.15,
    cornerRadius: 32,
    padding: '24px 32px',
    overLight: false,
    variant: 'regular',
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

// How many mosaic cells to render — enough to overfill the inset:-10% area at
// the cell size below so the glass always has dense content behind it.
const PLAYGROUND_CELLS = 300;

const PLAYGROUND_CSS = `
.lg-pg {
  position: relative;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: #0c1024;
  font-family: ${SANS_FONT};
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Dense photo mosaic — the HIGH-FREQUENCY content the glass refracts. Many
   small tiles (sharp edges, not smooth gradients) so displacement / aberration /
   blur / saturation / mode are clearly visible; a smooth gradient would make
   every refraction prop look dead. It is STATIC and has no transform/animation:
   the glass samples it via backdrop-filter, and anything that puts the backdrop
   (or a wrapper around the glass) into its own stacking context breaks that
   sampling — which is exactly what makes the controls feel dead. */
.lg-pg__mosaic {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, 76px);
  grid-auto-rows: 76px;
  gap: 7px;
  justify-content: center;
  align-content: center;
}
.lg-pg__cell { border-radius: 9px; }
/* CRITICAL: no z-index / transform / filter here. The glass must share a
   stacking context with the mosaic so its backdrop-filter actually samples it.
   position:relative (with z-index:auto) keeps the glass painted above the
   absolutely-positioned mosaic via DOM order WITHOUT creating a context. */
.lg-pg__stage { position: relative; }
.lg-pg__hint {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  margin: 0;
  padding: 7px 15px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 0.8rem;
}
`;

/**
 * Interactive sandbox: the glass floats (in normal flow, sharing the mosaic's
 * stacking context so backdrop-filter actually samples it) over a dense mosaic
 * of colorful photo tiles. The high-frequency tile edges make every refraction
 * prop (displacementScale, saturation, aberrationIntensity, blurAmount, mode)
 * VISIBLY change the result. Hover for the elastic follow; tweak everything from
 * the Controls panel.
 */
const PlaygroundStory = (args: LiquidGlassProps): ReactElement => {
  return (
    <div className="lg-pg">
      <style>{PLAYGROUND_CSS}</style>

      <div className="lg-pg__mosaic">
        {Array.from({ length: PLAYGROUND_CELLS }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative tiles, fixed order
            key={i}
            className="lg-pg__cell"
            style={{ background: photoTileBackground(i) }}
          />
        ))}
      </div>

      <p className="lg-pg__hint">
        Frosted by default — toggle <code>displacement</code> in the Controls panel ↓ to refract the
        photos (Chromium)
      </p>
      <div className="lg-pg__stage">
        <LiquidGlass {...args} />
      </div>
    </div>
  );
};

/**
 * Drive every prop from the controls panel. Move `displacementScale`,
 * `saturation`, `aberrationIntensity` and `elasticity` while hovering the
 * surface to feel the refraction and elastic follow — the dense photo mosaic
 * behind the glass makes each change clearly visible.
 */
export const Playground: Story = {
  args: {
    children: glassLabel('Liquid Glass'),
  },
  parameters: {
    layout: 'fullscreen',
    // Supplies its own full-bleed stage — opt out of the centered global
    // backdrop. Controls stay ENABLED here (this is the sandbox).
    noBackdrop: true,
    docs: {
      description: {
        story:
          'The interactive sandbox. Every prop is editable from the Controls ' +
          'panel below — it DEFAULTS to frosted (`displacement` off), the look ' +
          'most users get; flip the `displacement` toggle on Chromium to attach ' +
          'the live refraction. The glass floats over a dense mosaic of colorful ' +
          'photo tiles whose high-frequency edges make every refraction prop ' +
          'visibly change the result once displacement is on.',
      },
    },
  },
  render: (args) => <PlaygroundStory {...args} />,
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
    // Supplies its own full-bleed photo backdrop — opt out of the global one.
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Side-by-side matrix of every displacement mode over the same REAL ' +
          'photo, so polar / prominent / shader / turbulence differences are ' +
          'actually visible. Each tile shares the same geometry so only the ' +
          'distortion algorithm differs. Stronger displacement is used here so ' +
          'the per-mode character reads clearly against the busy backdrop.',
      },
    },
  },
  render: () => (
    <PhotosAppBackdrop>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1.5rem',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2rem',
            width: '100%',
            maxWidth: '64rem',
            pointerEvents: 'auto',
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
              <LiquidGlass
                displacement
                mode={mode}
                cornerRadius={28}
                padding="28px 36px"
                displacementScale={110}
                aberrationIntensity={4}
              >
                {glassLabel(mode)}
              </LiquidGlass>
              <figcaption
                style={{
                  color: '#1e293b',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  maxWidth: '16rem',
                  fontFamily: SANS_FONT,
                  background: 'rgba(255,255,255,0.7)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 10,
                }}
              >
                <strong style={{ textTransform: 'capitalize' }}>{mode}</strong>
                <br />
                {blurb}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </PhotosAppBackdrop>
  ),
};

/**
 * A deliberately designed showcase: a glass card + pill floating as a toolbar
 * over a calm, realistic Photos app (header + responsive grid of scenic
 * thumbnails). The photo grid is intentionally STATIC — calmer reads better and
 * is inherently reduced-motion-safe; the cursor-elastic follow on the glass
 * itself still demonstrates the refraction over real content.
 */
/**
 * Shared Showcase scene used by both the frosted-default `Showcase` story and the
 * refraction-on `DisplacementShowcase` story, so the two pin the SAME geometry /
 * content and differ ONLY by the `displacement` opt-in. e2e specs target each by
 * story id; keeping one scene keeps the frosted and displacement pixel baselines
 * comparable.
 */
const ShowcaseScene = ({ displacement = false }: { displacement?: boolean }): ReactElement => (
  <PhotosAppBackdrop>
    <div className="lg-showcase__stack">
      <style>{SHOWCASE_CSS}</style>
      <LiquidGlass
        displacement={displacement}
        cornerRadius={28}
        padding="32px 36px"
        displacementScale={80}
        saturation={160}
      >
        <div style={{ color: '#fff', maxWidth: '22rem' }}>
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Refraction, live
          </p>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', lineHeight: 1.2 }}>
            Light bends around the edges
          </h2>
          <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, opacity: 0.92 }}>
            Move your cursor across the panel to feel the elastic follow. The glass floats over the
            photo grid so the displacement reads clearly over real content.
          </p>
        </div>
      </LiquidGlass>

      <LiquidGlass
        displacement={displacement}
        cornerRadius={999}
        padding="14px 28px"
        displacementScale={60}
      >
        <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Get started</span>
      </LiquidGlass>
    </div>
  </PhotosAppBackdrop>
);

export const Showcase: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    // Supplies its own full-bleed Photos-app surface — opt out of the global one.
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'The DEFAULT (frosted) look: glass floating as a toolbar/card over a calm ' +
          'Photos app. Renders the portable frosted recipe (white tint + blur + ' +
          'saturate + hairline ring + bevel) identically in every engine — NO SVG ' +
          'refraction. See DisplacementShowcase for the Chromium opt-in refraction.',
      },
    },
  },
  render: () => <ShowcaseScene />,
};

/**
 * The OPT-IN refraction look: the same Showcase scene with `displacement` enabled.
 * On Chromium this attaches the SVG `feDisplacementMap` over `backdrop-filter`
 * (live edge-bending); on Firefox/WebKit `displacement` is a silent no-op and the
 * scene renders the same frosted base as `Showcase`. e2e specs target this story
 * for the "url( present" refraction assertions and the displacement pixel baseline.
 */
export const DisplacementShowcase: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Opt-in `displacement`: the Showcase scene with live SVG refraction. On ' +
          'Chromium the backdrop bends at the glass edges (feDisplacementMap over ' +
          'backdrop-filter); on Firefox/WebKit displacement is a no-op and it falls ' +
          'back to the identical frosted base. This is the web-only enhancement over ' +
          'the portable default.',
      },
    },
  },
  render: () => <ShowcaseScene displacement />,
};

const FROSTED_VS_CSS = `
.lg-fvd__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  pointer-events: none;
  font-family: ${SANS_FONT};
}
.lg-fvd__note {
  margin: 0;
  max-width: 42rem;
  text-align: center;
  padding: 0.65rem 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.45;
  background: rgba(15, 23, 42, 0.74);
  color: #fff;
}
.lg-fvd__row {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.lg-fvd__cell {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  pointer-events: auto;
}
.lg-fvd__cap {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: center;
  color: #1e293b;
  max-width: 18rem;
  background: rgba(255, 255, 255, 0.78);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
}
.lg-fvd__cap strong { font-size: 0.95rem; }
.lg-fvd__cap span { font-size: 0.85rem; opacity: 0.9; }
`;

/**
 * Frosted-default vs opt-in-displacement A/B over the SAME calm Photos backdrop.
 * Browser-aware: `useGlassCapabilities().canRefract` drives an annotation so a
 * viewer on Firefox/Safari (where `displacement` is a no-op and both panels
 * render the identical frosted recipe) understands the two identical panels are
 * by design, not a broken demo.
 */
const FrostedVsDisplacementStory = (): ReactElement => {
  const { canRefract } = useGlassCapabilities();
  return (
    <PhotosAppBackdrop>
      <style>{FROSTED_VS_CSS}</style>
      <div className="lg-fvd__overlay">
        <p className="lg-fvd__note">
          {canRefract
            ? 'This engine (Chromium) can refract: the right panel bends the photos at its edges ' +
              'via live SVG displacement, while the left stays purely frosted.'
            : 'This engine (Firefox / Safari) cannot refract, so `displacement` falls back to the ' +
              'frosted recipe — both panels render identically here by design, not because the ' +
              'demo is broken. Open this story in Chrome to see the refraction.'}
        </p>
        <div className="lg-fvd__row">
          <figure className="lg-fvd__cell">
            <LiquidGlass
              cornerRadius={28}
              padding="32px 36px"
              displacementScale={80}
              saturation={160}
            >
              {glassLabel('Frosted')}
            </LiquidGlass>
            <figcaption className="lg-fvd__cap">
              <strong>Frosted — default, all browsers</strong>
              <span>White tint + blur + saturate + hairline ring + bevel. No SVG refraction.</span>
            </figcaption>
          </figure>

          <figure className="lg-fvd__cell">
            <LiquidGlass
              displacement
              cornerRadius={28}
              padding="32px 36px"
              displacementScale={80}
              saturation={160}
            >
              {glassLabel('Displacement')}
            </LiquidGlass>
            <figcaption className="lg-fvd__cap">
              <strong>Displacement — Chrome opt-in</strong>
              <span>
                {canRefract
                  ? 'Live feDisplacementMap composited over backdrop-filter bends the photos at the edges.'
                  : 'Opt-in on Chromium; falls back to the identical frosted base on this engine.'}
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </PhotosAppBackdrop>
  );
};

export const FrostedVsDisplacement: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'The headline A/B: the SAME calm Photos backdrop under a FROSTED (default) ' +
          'panel and a DISPLACEMENT (opt-in) panel, side by side with identical ' +
          'geometry so only the refraction differs. Frosted is what every user gets ' +
          'by default in every engine; `displacement` is the web-only Chromium ' +
          'enhancement. The story is browser-aware — on Firefox/Safari, where ' +
          'displacement is a no-op, it annotates that both panels render the ' +
          'identical frosted recipe by design so two matching panels never read as ' +
          'a bug.',
      },
    },
  },
  render: () => <FrostedVsDisplacementStory />,
};

const PORTABLE_CSS = `
.lg-ph__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  pointer-events: none;
  font-family: ${SANS_FONT};
}
.lg-ph__overlay > * { pointer-events: auto; }
.lg-ph__legend {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  width: 100%;
  max-width: 46rem;
}
.lg-ph__legend li {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 12px;
  padding: 0.6rem 0.8rem;
  color: #1e293b;
  font-size: 0.82rem;
  line-height: 1.4;
}
.lg-ph__legend strong { display: block; font-size: 0.9rem; margin-bottom: 0.15rem; }
`;

/**
 * Portable highlights (plans 015/016): the specular hotspot, sheen / rim-light
 * and bevel that ship in the DEFAULT frosted recipe and render identically in
 * every engine — no SVG refraction required. Demonstrated over the calm Photos
 * backdrop with a legend that names each portable element.
 */
export const PortableHighlights: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'The portable "liquid" character that renders IDENTICALLY across Chromium, ' +
          'Firefox and Safari with NO refraction: the specular hotspot that tracks ' +
          'the pointer, the sheen / rim-light hairline around the edge, and the bevel ' +
          'that gives the surface depth. These ship in the default frosted recipe, so ' +
          'every engine gets the same lively glass even before opting into ' +
          '`displacement`.',
      },
    },
  },
  render: () => (
    <PhotosAppBackdrop>
      <style>{PORTABLE_CSS}</style>
      <div className="lg-ph__overlay">
        <LiquidGlass
          cornerRadius={28}
          padding="36px 40px"
          displacementScale={80}
          saturation={160}
          onClick={() => {}}
        >
          <div style={{ color: '#fff', maxWidth: '24rem', pointerEvents: 'none' }}>
            <p
              style={{
                margin: '0 0 0.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                opacity: 0.82,
              }}
            >
              Portable highlights
            </p>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', lineHeight: 1.2 }}>
              Lively glass in every engine
            </h2>
            <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, opacity: 0.92 }}>
              Move across the panel for the specular hotspot and press for the glow — the sheen,
              rim-light and bevel need no refraction, so this reads the same on Chromium, Firefox
              and Safari.
            </p>
          </div>
        </LiquidGlass>

        <ul className="lg-ph__legend">
          <li>
            <strong>Specular hotspot</strong>A bright highlight that tracks the pointer like light
            catching the surface.
          </li>
          <li>
            <strong>Sheen / rim-light</strong>A hairline ring around the edge that separates the
            glass from the backdrop.
          </li>
          <li>
            <strong>Bevel</strong>Inner light/dark edges that give the surface thickness and depth.
          </li>
          <li>
            <strong>Frosted base</strong>Blur + saturate + white tint — the recipe every engine
            shares by default.
          </li>
        </ul>
      </div>
    </PhotosAppBackdrop>
  ),
};

const SHOWCASE_CSS = `
.lg-showcase__stack {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  pointer-events: none;
}
.lg-showcase__stack > * { pointer-events: auto; }
`;

/**
 * Draggable glass: grab the panel and drag it (pointer OR touch) across the
 * busy photo. As it moves, DIFFERENT content refracts through the glass — the
 * single clearest way to feel the displacement. Wired entirely through the
 * existing public API: drag state feeds `globalMousePos` and the drag space is
 * scoped to the stage via `mouseContainer`. No new component.
 */
const DraggableStory = (): ReactElement => {
  const stageRef = useRef<HTMLDivElement>(null);
  // Glass top-left within the stage, in CSS pixels.
  const [pos, setPos] = useState<MousePos>({ x: 40, y: 40 });
  // Controlled pointer position fed to the primitive (viewport coords).
  const [globalMousePos, setGlobalMousePos] = useState<MousePos | undefined>(undefined);
  const dragging = useRef(false);
  // Offset from the glass top-left to the grab point, so the panel doesn't jump.
  const grab = useRef<MousePos>({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      grab.current = {
        x: e.clientX - rect.left - pos.x,
        y: e.clientY - rect.top - pos.y,
      };
      dragging.current = true;
      // Capture so dragging keeps working if the pointer leaves the handle.
      e.currentTarget.setPointerCapture(e.pointerId);
      setGlobalMousePos({ x: e.clientX, y: e.clientY });
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setGlobalMousePos({ x: e.clientX, y: e.clientY });
    if (!dragging.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const maxX = rect.width - 280;
    const maxY = rect.height - 180;
    const nx = Math.min(Math.max(0, e.clientX - rect.left - grab.current.x), Math.max(0, maxX));
    const ny = Math.min(Math.max(0, e.clientY - rect.top - grab.current.y), Math.max(0, maxY));
    setPos({ x: nx, y: ny });
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        // `touch-action: none` lets the panel be dragged on touch screens
        // without the browser hijacking the gesture for scrolling.
        touchAction: 'none',
      }}
    >
      <PhotosAppBackdrop
        style={{ position: 'absolute', inset: 0, minHeight: 0, height: '100%', overflow: 'auto' }}
      />
      <p
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.78)',
          color: '#fff',
          fontSize: '0.875rem',
          fontFamily: SANS_FONT,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        Drag the panel across the photos — watch the thumbnails refract underneath.
      </p>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          zIndex: 3,
          cursor: dragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <LiquidGlass
          displacement
          cornerRadius={28}
          padding="28px 32px"
          displacementScale={100}
          aberrationIntensity={4}
          globalMousePos={globalMousePos}
          mouseContainer={stageRef}
        >
          <div style={{ color: '#fff', maxWidth: '14rem', pointerEvents: 'none' }}>
            <strong style={{ display: 'block', fontSize: '1.05rem' }}>Drag me</strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              Different content bends through the glass as it moves.
            </span>
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
};

export const Draggable: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Drag the glass panel (pointer or touch) across the busy photo to see ' +
          'different content refract through it. Implemented purely with the ' +
          'public API: drag state feeds `globalMousePos`, and `mouseContainer` ' +
          'scopes the pointer space to the stage. No new component.',
      },
    },
  },
  render: () => <DraggableStory />,
};

/**
 * Scroll-under-glass: a glass bar pinned over a column of scrolling cards, so
 * the viewer sees real content move BEHIND the glass — the "lifts above
 * scrolling content" effect. Auto-scroll is gated behind prefers-reduced-motion.
 */
const SCROLL_UNDER_CSS = `
.lg-scroll {
  position: relative;
  height: 100vh;
  width: 100%;
  overflow-y: auto;
  background: linear-gradient(180deg, #fbfcfe 0%, #eef1f6 100%);
  scroll-behavior: smooth;
  font-family: ${SANS_FONT};
}
.lg-scroll__col {
  max-width: 36rem;
  margin: 0 auto;
  padding: 7rem 1.5rem 6rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.lg-scroll__card {
  position: relative;
  border-radius: 18px;
  padding: 1.5rem 1.5rem;
  min-height: 8rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}
/* A legibility scrim so the white caption reads over any scenic tile. */
.lg-scroll__card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15,23,42,0) 30%, rgba(15,23,42,0.55) 100%);
  pointer-events: none;
}
.lg-scroll__card h3,
.lg-scroll__card p { position: relative; z-index: 1; text-shadow: 0 1px 4px rgba(0,0,0,0.45); }
.lg-scroll__card h3 { margin: 0 0 0.4rem; font-size: 1.1rem; }
.lg-scroll__card p { margin: 0; font-size: 0.9rem; line-height: 1.5; }
.lg-scroll__bar {
  position: sticky;
  top: 1.5rem;
  z-index: 5;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
`;

const SCROLL_CARDS = [
  { t: 'Refraction reads on motion', d: 'Glass only convinces when content moves under it.' },
  { t: 'Edge-bending', d: 'High-frequency color makes the displacement obvious.' },
  { t: 'Pinned chrome', d: 'A fixed glass bar over scrolling content is the classic use.' },
  { t: 'Legibility', d: 'Frost + saturation keep text readable over busy photos.' },
  { t: 'Same-origin', d: 'The backdrop is bundled, not remote — no CORS taint.' },
  { t: 'Reduced motion', d: 'No auto-scroll when the user asks for less motion.' },
  { t: 'Try scrolling', d: 'Drag the scrollbar or flick — the bar stays put.' },
  { t: 'More content', d: 'Keep going to watch the photo cards pass under the glass.' },
];

const ScrollUnderGlassStory = (): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className="lg-scroll">
      <style>{SCROLL_UNDER_CSS}</style>

      <div className="lg-scroll__bar">
        <LiquidGlass
          displacement
          cornerRadius={999}
          padding="14px 30px"
          displacementScale={90}
          aberrationIntensity={3}
          mouseContainer={scrollRef}
        >
          <span
            style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Pinned glass — scroll the cards beneath
          </span>
        </LiquidGlass>
      </div>

      <div className="lg-scroll__col">
        {SCROLL_CARDS.map((c, i) => (
          <article
            key={c.t}
            className="lg-scroll__card"
            style={{
              // Each card is a different scenic tile, so a varied region moves
              // under the glass bar as the column scrolls.
              background: photoTileBackground(i),
            }}
          >
            <h3>{c.t}</h3>
            <p>{c.d}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export const ScrollUnderGlass: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'A glass bar pinned over a scrolling column of photo cards. Scroll the ' +
          'column and watch real content pass UNDER the glass (the "lifts above ' +
          'scrolling content" effect). Any decorative motion is gated behind ' +
          'prefers-reduced-motion.',
      },
    },
  },
  render: () => <ScrollUnderGlassStory />,
};

/**
 * Scroll-aware shadow (plan 021): a glass bar pinned over a column that
 * alternates DARK/dense and LIGHT/solid bands. With opt-in `scrollAwareShadow`,
 * the glass's decoupled drop-shadow DEEPENS and DARKENS as a dark band scrolls
 * beneath it (lifting it above the content) and EASES/LIGHTENS over a light band —
 * the same backdrop-luminance infra (017) that powers `adaptiveTint`, but driving
 * the shadow's depth instead of the tint. Modulation runs in a post-mount effect
 * (SSR-safe) and snaps (no animated transition) under prefers-reduced-motion.
 */
const SCROLL_SHADOW_CSS = `
.lg-sas {
  position: relative;
  height: 100vh;
  width: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
}
.lg-sas__col {
  display: flex;
  flex-direction: column;
}
.lg-sas__band {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  box-sizing: border-box;
  font-family: ${SANS_FONT};
  text-align: center;
}
.lg-sas__band--dark {
  /* Dark "album" section: a deep night-terrace tile so the sampler reads DARK
     and the shadow deepens. A solid-color fill keeps the luminance unambiguous. */
  background: #1b2140;
  color: #fff;
}
.lg-sas__band--light {
  /* Light "album" section: a near-white flat fill — shadow should ease here. */
  background: #f4f5f8;
  color: #1a1d26;
}
.lg-sas__band p { max-width: 26rem; margin: 0; font-size: 0.95rem; line-height: 1.6; opacity: 0.92; }
.lg-sas__bar {
  position: sticky;
  top: 1.5rem;
  z-index: 5;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
`;

const SCROLL_SHADOW_BANDS = [
  {
    tone: 'dark',
    d: 'DARK / dense band — the shadow deepens and darkens here, lifting the bar above the busy content.',
  },
  {
    tone: 'light',
    d: 'LIGHT / solid band — the shadow eases and lightens, sitting closer to a calm surface.',
  },
  {
    tone: 'dark',
    d: 'Scroll back and forth to watch the drop-shadow depth track the backdrop behind the pinned bar.',
  },
  {
    tone: 'light',
    d: 'Default-off keeps today’s static shadow byte-for-byte; this story opts in with scrollAwareShadow.',
  },
] as const;

const ScrollAwareShadowStory = (): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className="lg-sas">
      <style>{SCROLL_SHADOW_CSS}</style>

      <div className="lg-sas__bar">
        <LiquidGlass
          scrollAwareShadow
          cornerRadius={999}
          padding="14px 30px"
          displacementScale={90}
          aberrationIntensity={3}
          mouseContainer={scrollRef}
        >
          <span
            style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Pinned glass — its shadow tracks the backdrop
          </span>
        </LiquidGlass>
      </div>

      <div className="lg-sas__col">
        {SCROLL_SHADOW_BANDS.map((b, i) => (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: static, never-reordered demo bands
            key={i}
            className={`lg-sas__band lg-sas__band--${b.tone}`}
          >
            <p>{b.d}</p>
          </section>
        ))}
      </div>
    </div>
  );
};

export const ScrollAwareShadow: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Opt-in `scrollAwareShadow`: a pinned glass bar over alternating ' +
          'dark/dense and light/solid bands. The decoupled drop-shadow DEEPENS ' +
          'over dark content and EASES over light — driven by the same ' +
          'backdrop-luminance sampler as `adaptiveTint`. The shadow stays a ' +
          'sibling behind the clipped surface (only its blur/offset/opacity ' +
          'vary), modulation is deferred to a post-mount effect (SSR-safe), and ' +
          'it snaps without animating under prefers-reduced-motion.',
      },
    },
  },
  render: () => <ScrollAwareShadowStory />,
};

/**
 * Cheap vs real: the same photo behind a plain `backdrop-filter: blur` panel
 * (LEFT) and a full `<LiquidGlass>` displacement panel (RIGHT). Side by side,
 * the refraction edge-bending the library adds over a naive blur is obvious.
 */
const CHEAP_VS_REAL_CSS = `
.lg-cvr {
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: 4rem 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2.5rem;
  align-items: center;
  justify-items: center;
  /* A busy but tasteful scenic surface (same family as the photo tiles) so both
     panels sit over identical, varied content — the difference between blur and
     real displacement reads at the edges. */
  background:
    radial-gradient(circle at 22% 28%, rgba(255,255,255,0.35), transparent 42%),
    radial-gradient(circle at 78% 70%, rgba(255,255,255,0.25), transparent 46%),
    linear-gradient(150deg, #f4c98f 0%, #6db5c9 38%, #6f9d5f 70%, #5d4b86 100%);
  font-family: ${SANS_FONT};
}
.lg-cvr__cell { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.lg-cvr__cheap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16rem;
  min-height: 7rem;
  padding: 28px 32px;
  border-radius: 28px;
  box-sizing: border-box;
  /* The naive "glassmorphism" recipe: blur + a translucent fill. No displacement. */
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 30px rgba(0,0,0,0.2);
}
.lg-cvr__cap {
  color: #fff;
  text-align: center;
  max-width: 18rem;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
}
.lg-cvr__cap strong { display: block; font-size: 1rem; }
.lg-cvr__cap span { font-size: 0.85rem; opacity: 0.9; }
`;

export const CheapVsReal: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Plain `backdrop-filter: blur` (left) vs the full `<LiquidGlass>` ' +
          'displacement (right) over the SAME photo. The right panel bends the ' +
          'backdrop at its edges (refraction); the left only blurs it. The ' +
          'difference is the whole point of the library.',
      },
    },
  },
  render: () => (
    <div className="lg-cvr">
      <style>{CHEAP_VS_REAL_CSS}</style>

      <div className="lg-cvr__cell">
        <div className="lg-cvr__cheap">{glassLabel('Blur only')}</div>
        <p className="lg-cvr__cap">
          <strong>Cheap — backdrop-filter: blur</strong>
          <span>Frosts the photo but the edges stay straight. No refraction.</span>
        </p>
      </div>

      <div className="lg-cvr__cell">
        <LiquidGlass
          displacement
          cornerRadius={28}
          padding="28px 32px"
          displacementScale={110}
          aberrationIntensity={5}
        >
          {glassLabel('Displacement')}
        </LiquidGlass>
        <p className="lg-cvr__cap">
          <strong>Real — &lt;LiquidGlass&gt;</strong>
          <span>The SVG displacement map bends the photo at the edges (Chromium).</span>
        </p>
      </div>
    </div>
  ),
};

/**
 * Specular hotspot + glow-on-press (plan 016): a positioned radial highlight
 * that tracks the pointer across the glass, plus an inner glow that blooms from
 * the contact point on press. Both are pure CSS (render in every engine,
 * independent of refraction) and gate on prefers-reduced-motion. Demonstrated
 * over the same real demo photo used by the Showcase story.
 */
export const Specular: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Move the cursor across the panel: a bright specular hotspot tracks the ' +
          'pointer like light catching on glass (not a flat angle sweep). Press ' +
          'and a glow blooms outward from the contact point, then fades. Pure CSS ' +
          '— renders in every engine regardless of refraction support — and gated ' +
          'on prefers-reduced-motion (static hotspot, no animated bloom).',
      },
    },
  },
  render: () => (
    <PhotosAppBackdrop>
      <style>{SPECULAR_CSS}</style>
      <div className="lg-spec__stack">
        <LiquidGlass
          cornerRadius={28}
          padding="36px 40px"
          displacementScale={80}
          saturation={160}
          onClick={() => {}}
        >
          <div style={{ color: '#fff', maxWidth: '22rem', pointerEvents: 'none' }}>
            <p
              style={{
                margin: '0 0 0.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                opacity: 0.8,
              }}
            >
              Specular, live
            </p>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', lineHeight: 1.2 }}>
              The highlight follows your cursor
            </h2>
            <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, opacity: 0.92 }}>
              Move across the panel to ride the specular hotspot, then press to bloom a glow from
              the contact point.
            </p>
          </div>
        </LiquidGlass>

        <LiquidGlass
          cornerRadius={999}
          padding="14px 28px"
          displacementScale={60}
          onClick={() => {}}
        >
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', pointerEvents: 'none' }}>
            Press me
          </span>
        </LiquidGlass>
      </div>
    </PhotosAppBackdrop>
  ),
};

const SPECULAR_CSS = `
.lg-spec__stack {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  pointer-events: none;
}
.lg-spec__stack > * { pointer-events: auto; }
`;

/**
 * Content-adaptive auto-tint (plan 018): the HEADLINE feature. The stage is split
 * into a BRIGHT half and a DARK half (the same-origin demo photo on the dark
 * side, a near-white wash on the light side). Two identical `<LiquidGlass>`
 * cards — both with `adaptiveTint`, neither with an explicit `overLight` — sit
 * one over each region. Each samples the luminance behind it and automatically
 * shifts toward the light or dark treatment so its label stays legible WITHOUT
 * hand-setting `overLight`: the card over the bright region picks DARK ink and a
 * lighter tint, the card over the dark region picks LIGHT ink. A third card sets
 * an explicit `overLight` to demonstrate the precedence rule (manual wins).
 *
 * Same-origin backdrop ⇒ canvas sampling never taints. Over an unknown / cross-
 * origin backdrop the reading is `sampled: false` and the glass silently falls
 * back to the default `overLight ?? false` treatment (no error, no flicker).
 */
export const AdaptiveTint: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Opt-in `adaptiveTint`: glass that samples the brightness behind it and ' +
          'auto-shifts toward a light or dark treatment so its label stays ' +
          'legible over both a bright and a dark region — no manual `overLight`. ' +
          'An explicit `overLight` always wins (precedence). Best-effort ' +
          'legibility; verify critical text over unknown / cross-origin backdrops.',
      },
    },
  },
  render: () => (
    <div className="lg-adaptive">
      <style>{ADAPTIVE_CSS}</style>
      <div className="lg-adaptive__bright" />
      <div className="lg-adaptive__dark" />

      <div className="lg-adaptive__row">
        <LiquidGlass adaptiveTint cornerRadius={20} padding="22px 26px" displacementScale={70}>
          <div style={{ maxWidth: '15rem' }}>
            <p className="lg-adaptive__eyebrow">Over bright</p>
            <strong style={{ fontSize: '1.1rem' }}>Auto dark ink</strong>
            <p className="lg-adaptive__body">
              Sampled a light backdrop, so the label flips to dark for legibility.
            </p>
          </div>
        </LiquidGlass>

        <LiquidGlass adaptiveTint cornerRadius={20} padding="22px 26px" displacementScale={70}>
          <div style={{ maxWidth: '15rem' }}>
            <p className="lg-adaptive__eyebrow">Over dark</p>
            <strong style={{ fontSize: '1.1rem' }}>Auto light ink</strong>
            <p className="lg-adaptive__body">
              Sampled a dark backdrop, so the label stays light. Same component, no
              <code> overLight</code>.
            </p>
          </div>
        </LiquidGlass>
      </div>

      <div className="lg-adaptive__row">
        <LiquidGlass adaptiveTint overLight cornerRadius={999} padding="14px 28px">
          <span style={{ fontWeight: 600, color: 'rgba(17,17,20,0.96)' }}>
            Explicit overLight wins
          </span>
        </LiquidGlass>
      </div>
    </div>
  ),
};

const ADAPTIVE_CSS = `
.lg-adaptive {
  position: relative;
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
  background: #0c1024;
  font-family: ${SANS_FONT};
}
/* Bright "album" (left): a SOLID near-white background so the default
   canvas-free DOM-background sampler (plan 017) reads it as a LIGHT scheme.
   Sampling a CSS gradient is unsupported, so this region MUST stay solid. */
.lg-adaptive__bright {
  position: absolute;
  inset: 0 50% 0 0;
  background-color: #f2f5fb;
}
/* Dark "album" (right): a SOLID deep tone so the sampler reads a DARK scheme.
   Also solid (not a gradient/photo) so the light↔dark flip stays unambiguous. */
.lg-adaptive__dark {
  position: absolute;
  inset: 0 0 0 50%;
  background-color: #161b2e;
}
.lg-adaptive__row {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 6rem;
  align-items: center;
}
.lg-adaptive__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.7;
}
.lg-adaptive__body {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  line-height: 1.45;
  opacity: 0.92;
}
`;

/**
 * Regular vs Clear material variant (plan 019). Apple distinguishes two Liquid
 * Glass materials: `'regular'` (the default — a dependable, fully adaptive
 * control surface) and `'clear'` (permanently MORE transparent for media-rich
 * contexts, with NO adaptive behavior and a subtle dimming scrim so labels stay
 * legible over busy media). Two identical cards sit side by side over the SAME
 * same-origin demo photo so the difference is obvious: the Clear card lets more
 * of the photo show through while its label stays readable. Per Apple's
 * guidance the two should never be mixed in the same context.
 */
export const Variants: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Regular vs Clear over the same photo. `variant="clear"` is permanently ' +
          'more transparent (lower tint) for media-rich contexts and is ' +
          'NON-ADAPTIVE by definition — `adaptiveTint` is a no-op in Clear — while ' +
          'a dimming scrim keeps labels legible. `variant="regular"` (default) is ' +
          'unchanged. The two should never be mixed in the same context.',
      },
    },
  },
  render: () => (
    <PhotosAppBackdrop>
      <style>{VARIANTS_CSS}</style>
      <div className="lg-variants__row">
        <figure className="lg-variants__cell">
          <LiquidGlass
            variant="regular"
            cornerRadius={24}
            padding="28px 32px"
            displacementScale={80}
          >
            <div style={{ color: '#fff', maxWidth: '15rem', pointerEvents: 'none' }}>
              <p className="lg-variants__eyebrow">Regular</p>
              <strong style={{ fontSize: '1.15rem' }}>Dependable control surface</strong>
              <p className="lg-variants__body">
                The default material — fully adaptive, legible over anything.
              </p>
            </div>
          </LiquidGlass>
          <figcaption className="lg-variants__cap">
            <strong>variant="regular"</strong>
            <span>Today's behavior, unchanged. Pairs with adaptiveTint.</span>
          </figcaption>
        </figure>

        <figure className="lg-variants__cell">
          <LiquidGlass variant="clear" cornerRadius={24} padding="28px 32px" displacementScale={80}>
            <div style={{ color: '#fff', maxWidth: '15rem', pointerEvents: 'none' }}>
              <p className="lg-variants__eyebrow">Clear</p>
              <strong style={{ fontSize: '1.15rem' }}>More transparent over media</strong>
              <p className="lg-variants__body">
                More of the photo shows through; a dimming scrim keeps text legible.
              </p>
            </div>
          </LiquidGlass>
          <figcaption className="lg-variants__cap">
            <strong>variant="clear"</strong>
            <span>Permanently clearer. Non-adaptive by definition.</span>
          </figcaption>
        </figure>
      </div>
    </PhotosAppBackdrop>
  ),
};

const VARIANTS_CSS = `
.lg-variants__row {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4rem;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem;
  box-sizing: border-box;
  font-family: ${SANS_FONT};
  pointer-events: none;
}
.lg-variants__cell { pointer-events: auto; }
.lg-variants__cell {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}
.lg-variants__cap {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: center;
  color: #1e293b;
  max-width: 18rem;
  background: rgba(255,255,255,0.72);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
}
.lg-variants__cap strong { font-size: 0.95rem; }
.lg-variants__cap span { font-size: 0.85rem; opacity: 0.9; }
.lg-variants__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.7;
}
.lg-variants__body {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  line-height: 1.45;
  opacity: 0.92;
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
    // Curated story with its own fixed-prop glass — the Controls panel is inert
    // here, so hide it; only Playground is driven by the controls.
    controls: { disable: true },
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
          <LiquidGlass displacement cornerRadius={24} padding="28px 32px" displacementScale={80}>
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

/**
 * Cross-browser copy refraction (plan 030). Unlike `displacement` (which bends
 * the LIVE page via Chromium-only `backdrop-filter: url(#…)`), this applies the
 * SAME SVG displacement filter as an ELEMENT `filter: url(#…)` to a COPY of
 * content — which runs in Chromium, Firefox AND WebKit. Two panels:
 *
 *   - IN-PLACE (left): `size`/`center` refract a copy of the panel's OWN
 *     high-frequency children; the crisp label renders on top.
 *   - `refract={node}` (right): a lens floated over a photo mosaic it does not
 *     own — the mosaic is cloned + filtered, `behind` fills the bleed, and the
 *     crisp caption stays selectable on top.
 *
 * e2e (`cross-browser-refraction.spec.ts`) targets this story to prove the
 * `[data-lg-refraction-copy]` layer carries `filter: url(` on all three engines.
 */
const REFRACT_CSS = `
.lg-rf {
  position: relative;
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: 4rem 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
  align-items: center;
  justify-content: center;
  background: #0c1024;
  font-family: ${SANS_FONT};
}
.lg-rf__cell { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.lg-rf__cap {
  color: #e2e8f0;
  text-align: center;
  max-width: 18rem;
  font-size: 0.85rem;
  line-height: 1.5;
  background: rgba(15, 23, 42, 0.6);
  padding: 0.55rem 0.8rem;
  border-radius: 12px;
}
.lg-rf__cap strong { display: block; color: #fff; font-size: 0.95rem; margin-bottom: 0.2rem; }
/* High-frequency content so the displacement of the copy is clearly visible. */
.lg-rf__mosaic {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, 40px);
  grid-auto-rows: 40px;
  gap: 4px;
}
.lg-rf__tile { border-radius: 6px; }
.lg-rf__hero {
  position: relative;
  width: 15rem;
  height: 9rem;
  border-radius: 8px;
  overflow: hidden;
}
`;

const REFRACT_TILES = 120;

export const Refract: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    noBackdrop: true,
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Cross-browser copy refraction (plan 030). The refracted layer uses an ' +
          'ELEMENT `filter: url(#…)` over a COPY of content, so it renders in ' +
          'Chromium, Firefox AND Safari — unlike the Chromium-only backdrop bend. ' +
          'Left panel refracts a copy of its OWN children in-place (size/center); ' +
          'the right panel floats a lens over a photo mosaic it clones via ' +
          '`refract={node}`, with crisp children on top.',
      },
    },
  },
  render: () => {
    const mosaic = (
      <div className="lg-rf__mosaic" aria-hidden>
        {Array.from({ length: REFRACT_TILES }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative tiles
            key={i}
            className="lg-rf__tile"
            style={{ background: photoTileBackground(i) }}
          />
        ))}
      </div>
    );
    return (
      <div className="lg-rf">
        <style>{REFRACT_CSS}</style>

        {/* IN-PLACE: refract a copy of the panel's OWN vivid children. */}
        <figure className="lg-rf__cell" style={{ margin: 0 }}>
          <LiquidGlass
            size={{ width: 240, height: 144 }}
            center={{ x: 0.5, y: 0.5 }}
            displacementScale={90}
            aberrationIntensity={4}
            cornerRadius={20}
            padding="0"
          >
            <div
              className="lg-rf__hero"
              style={{
                background:
                  'conic-gradient(from 20deg, #f97316, #22d3ee, #a855f7, #f43f5e, #f97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>In-place</span>
            </div>
          </LiquidGlass>
          <figcaption className="lg-rf__cap">
            <strong>In-place (size / center)</strong>
            The glass refracts a copy of its OWN children; the crisp label stays on top.
          </figcaption>
        </figure>

        {/* refract={node}: a lens floated over a mosaic it does not own. */}
        <figure className="lg-rf__cell" style={{ margin: 0 }}>
          <LiquidGlass
            refract={mosaic}
            behind="#0c1024"
            size={{ width: 240, height: 144 }}
            displacementScale={110}
            aberrationIntensity={5}
            cornerRadius={20}
            padding="28px 32px"
          >
            <span style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
              refract=node
            </span>
          </LiquidGlass>
          <figcaption className="lg-rf__cap">
            <strong>refract=&#123;node&#125;</strong>A cloned mosaic is filtered behind the crisp
            caption; runs in every engine.
          </figcaption>
        </figure>
      </div>
    );
  },
};

const CROSS_BROWSER_CSS = `
.lg-xb {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 3rem 1.5rem;
  color: #fff;
  background:
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%),
    linear-gradient(135deg, #1f2233 0%, #2f3a6b 45%, #3f6f86 100%);
  font-family: ${SANS_FONT};
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
