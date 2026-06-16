import '@testing-library/jest-dom/vitest';

/**
 * jsdom does not implement `ResizeObserver`. The `<LiquidGlass>` component
 * (plan 004) measures its rendered size via `ResizeObserver` (rAF-throttled) in
 * the browser, and falls back to a one-shot `getBoundingClientRect()` read on
 * mount everywhere. Providing a minimal stub here keeps the component's
 * browser-path effect from crashing under jsdom; tests drive measurement
 * through `getBoundingClientRect` (which they stub per-element). The stub
 * captures the callback and exposes a static registry so a test could trigger
 * it manually if needed.
 */
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  callback: ResizeObserverCallback;
  elements = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element): void {
    this.elements.add(target);
  }

  unobserve(target: Element): void {
    this.elements.delete(target);
  }

  disconnect(): void {
    this.elements.clear();
  }

  /** Test helper: synchronously fire the callback for all observed elements. */
  trigger(): void {
    const entries = [...this.elements].map(
      (target) => ({ target, contentRect: target.getBoundingClientRect() }) as ResizeObserverEntry,
    );
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
