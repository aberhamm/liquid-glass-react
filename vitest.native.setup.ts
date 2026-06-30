import { vi } from 'vitest';

// Native test setup (plan 024 toolchain split).
//
// React Native and the Expo modules expect a Metro/native runtime that does
// not exist under Vitest's "node" environment. These mocks let plan 025's
// `*.native.test.*` files render and assert against the native component tree
// (via @testing-library/react-native + react-test-renderer) without a device.
// Each factory returns just enough surface for the component under test; plan
// 025 may extend these as it adds real native tests.

// `react-native` ships dozens of native-backed exports; mock the primitives the
// liquid-glass native component (plan 025) actually touches.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (specifics: Record<string, unknown>) => specifics.ios },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    flatten: (style: unknown) => style,
    absoluteFillObject: {},
  },
  View: 'View',
  Text: 'Text',
}));

// expo-blur's <BlurView> wraps a native view; a string host component is enough
// for react-test-renderer to mount it.
vi.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// expo-linear-gradient's <LinearGradient> likewise resolves to a native view.
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));
