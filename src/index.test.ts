import { describe, expect, it } from 'vitest';
import * as api from './index';
import { VERSION } from './index';

describe('package entry', () => {
  it('exposes the placeholder VERSION export', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('re-exports the live useReducedTransparency hook (plan 013)', () => {
    expect(typeof api.useReducedTransparency).toBe('function');
  });
});
