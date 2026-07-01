/**
 * Native render smoke test for `<LiquidGlass>` (plan 025).
 *
 * Runs under `vitest.native.config.ts` (the plan-024 native runner): a non-jsdom
 * "node" environment where `react-native`, `expo-blur`, and `expo-linear-gradient`
 * are mocked to string host components (see `vitest.native.setup.ts`).
 *
 * It renders with `react-test-renderer` directly — the device-free reconciler
 * that `@testing-library/react-native` itself wraps. RNTL's own `render` is NOT
 * used here: RNTL v14 targets React 19 and a full react-native jest preset (with
 * a Flow transform for react-native's internals), neither of which exists in this
 * React-18 vitest "node" harness — importing it parses react-native's Flow source
 * and throws. Driving `react-test-renderer` against the lightweight module mocks
 * is the pragmatic device-free path and asserts exactly what we need: the frosted
 * recipe is wired and children render above it.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { LiquidGlass } from './liquid-glass.native';

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

describe('LiquidGlass (native)', () => {
  it('renders a BlurView-backed frosted surface with children', () => {
    const renderer = renderNative(
      <LiquidGlass>
        <Text>native glass</Text>
      </LiquidGlass>,
    );
    const root = renderer.root;

    // The frosted backdrop is a real BlurView, and the specular sheen is a
    // LinearGradient — both driven by the shared tokens.
    expect(root.findAllByType(BlurView).length).toBeGreaterThan(0);
    expect(root.findAllByType(LinearGradient).length).toBeGreaterThan(0);

    // Children render above the surface layers.
    expect(textContent(root)).toContain('native glass');

    // The BlurView is configured from `blurAmount` (default → intensity 25).
    const blur = root.findByType(BlurView);
    expect(blur.props.intensity).toBe(25);

    renderer.unmount();
  });

  it('wires onPress to a pressable surface', () => {
    const onPress = vi.fn();
    const renderer = renderNative(
      <LiquidGlass onPress={onPress}>
        <Text>tap</Text>
      </LiquidGlass>,
    );
    const root = renderer.root;

    // Still a frosted BlurView surface, now interactive via a Pressable.
    expect(root.findAllByType(BlurView).length).toBeGreaterThan(0);
    const pressable = root.findAll(
      (node) => node.type === 'Pressable' && typeof node.props.onPress === 'function',
    );
    expect(pressable.length).toBe(1);
    expect(textContent(root)).toContain('tap');

    renderer.unmount();
  });
});
