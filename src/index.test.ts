import { describe, expect, it } from 'vitest';
import { VERSION } from './index';

describe('package entry', () => {
  it('exposes the placeholder VERSION export', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
