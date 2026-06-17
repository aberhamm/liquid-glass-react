import type { Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useCallback, useRef, useState } from 'react';
import { LiquidGlass } from './liquid-glass';
import type { DisplacementMode, MousePos } from './types';

/**
 * Same-origin demo backdrop (CC0, self-authored — see `public/demo/LICENSE.md`),
 * served by Storybook from `public/demo/` via `staticDirs`. A rich synthetic
 * image with high-frequency color + sharp edges so refraction edge-bending is
 * obvious. Same-origin so it can be sampled via canvas without CORS taint.
 */
const DEMO_PHOTO_URL = './demo/showcase-backdrop.webp';

/**
 * `<LiquidGlass>` is the low-level primitive every prebuilt component wraps. The
 * stories below are the interactive documentation surface: the `Playground`
 * exposes every prop as a live control, `Modes` exercises all five displacement
 * algorithms over a real photo, `Showcase` floats glass over the demo photo, and
 * the `Draggable` / `ScrollUnderGlass` / `CheapVsReal` stories let the viewer
 * SEE refraction by moving content under the glass. Full refraction renders in
 * Chromium and degrades cleanly elsewhere — see the CrossBrowser story.
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
    // Supplies its own full-bleed photo backdrop — opt out of the global one.
    noBackdrop: true,
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
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        padding: '4rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `center / cover no-repeat url("${DEMO_PHOTO_URL}")`,
      }}
    >
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
            <LiquidGlass
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
                color: '#fff',
                fontSize: '0.8125rem',
                textAlign: 'center',
                maxWidth: '16rem',
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
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
  ),
};

/**
 * A deliberately designed showcase: a glass panel and pill floating over the
 * rich, same-origin demo PHOTO. A slow pan of the photo background drives motion
 * under the glass so refraction edge-bending reads clearly; under
 * `prefers-reduced-motion: reduce` the pan is dropped for a static backdrop.
 */
export const Showcase: Story = {
  args: { children: null },
  parameters: {
    layout: 'fullscreen',
    // Supplies its own full-bleed photo backdrop — opt out of the global one.
    noBackdrop: true,
    docs: {
      description: {
        story:
          'Glass floating over the rich demo photo so refraction edge-bending and ' +
          'cursor elasticity are obvious over REAL content (not a flat gradient). ' +
          'The photo slowly pans beneath the glass; honors prefers-reduced-motion ' +
          'by falling back to a static backdrop.',
      },
    },
  },
  render: () => (
    <div className="lg-showcase">
      <style>{SHOWCASE_CSS}</style>
      <div className="lg-showcase__photo" />

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
              Move your cursor across the panel to feel the elastic follow. The photo drifts beneath
              the glass so the displacement reads clearly over real content.
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
  background: #0c1024;
}
.lg-showcase__photo {
  position: absolute;
  inset: -6% -6% -6% -6%;
  background: center / cover no-repeat url("${DEMO_PHOTO_URL}");
  will-change: transform;
  animation: lg-showcase-pan 24s ease-in-out infinite alternate;
}
.lg-showcase__stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
}
@keyframes lg-showcase-pan {
  0%   { transform: translate3d(-3%, -2%, 0) scale(1.08); }
  100% { transform: translate3d(3%, 2%, 0) scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .lg-showcase__photo {
    animation: none;
    transform: none;
    inset: 0;
  }
}
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
        background: `center / cover no-repeat url("${DEMO_PHOTO_URL}")`,
      }}
    >
      <p
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.45)',
          color: '#fff',
          fontSize: '0.875rem',
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        Drag the panel across the photo — watch the content refract underneath.
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
          cursor: dragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <LiquidGlass
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
  background: #0c1024;
  scroll-behavior: smooth;
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
  border-radius: 18px;
  padding: 1.5rem 1.5rem;
  min-height: 7rem;
  color: #0c1024;
  font-family: system-ui, sans-serif;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  background-size: cover;
  background-position: center;
}
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
              // Slice the demo photo so each card shows a different busy region
              // moving under the glass as the column scrolls.
              backgroundImage: `linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url("${DEMO_PHOTO_URL}")`,
              backgroundPosition: `${(i * 137) % 100}% ${(i * 53) % 100}%`,
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
  background: center / cover no-repeat url("${DEMO_PHOTO_URL}");
  font-family: system-ui, sans-serif;
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
