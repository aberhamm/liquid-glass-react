/**
 * Consumer-style native render smoke test (plan 026).
 *
 * Distinct from `liquid-glass.native.test.tsx` (plan 025), which imports the
 * component from its deep internal path (`./liquid-glass.native`). THIS test
 * mounts `<LiquidGlass>` exactly as an Expo consumer would after Metro resolves
 * the `react-native` export condition: through the public NATIVE BARREL
 * (`./index.native`, i.e. `dist/native/index.native.js`). That proves the
 * barrel actually re-exports a working component and its shared token surface,
 * not just that the internal module renders.
 *
 * Runs under `vitest.native.config.ts` (the plan-024 native runner): a non-jsdom
 * "node" environment where `react-native`, `expo-blur`, and `expo-linear-gradient`
 * are mocked to string host components (see `vitest.native.setup.ts`). Rendering
 * uses `react-test-renderer` directly (see the note in the plan-025 test for why
 * RNTL's own renderer is unavailable in this React-18 vitest harness).
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

// Consumer-style import: the public native barrel, NOT the internal module path.
import { DEFAULTS, LiquidGlass } from './index.native';

function renderNative(element: ReactElement): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Collect the rendered text content across all mocked `Text` host nodes. */
function textContent(root: ReactTestInstance): string {
  return root
    .findAll((node) => node.type === (Text as unknown as string))
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join('');
}

describe('LiquidGlass via the native barrel (consumer integration)', () => {
  it('re-exports a working component that renders a non-empty frosted tree with children', () => {
    const renderer = renderNative(
      <LiquidGlass>
        <Text>barrel glass</Text>
      </LiquidGlass>,
    );
    const root = renderer.root;

    // Non-empty tree: the frosted BlurView surface + specular LinearGradient
    // sheen are present, and the consumer's children render above them.
    expect(root.findAllByType(BlurView).length).toBeGreaterThan(0);
    expect(root.findAllByType(LinearGradient).length).toBeGreaterThan(0);
    expect(textContent(root)).toContain('barrel glass');

    renderer.unmount();
  });

  it('re-exports the shared design tokens through the same barrel', () => {
    // The barrel is the single import surface an Expo consumer touches, so the
    // platform-neutral tokens (plan 022) must ride along with the component.
    expect(DEFAULTS).toBeDefined();
    expect(typeof DEFAULTS).toBe('object');
  });
});
