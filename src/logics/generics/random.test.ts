import { afterEach, describe, expect, it, vi } from 'vitest';
import { choice, shuffle } from './random';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffle', () => {
  it('keeps the same elements (deterministic with mocked Math.random)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toHaveLength(original.length);
    expect([...arr].sort()).toEqual([...original].sort());
  });

  it('handles empty arrays', () => {
    const arr: number[] = [];
    shuffle(arr);
    expect(arr).toEqual([]);
  });
});

describe('choice', () => {
  it('returns the first element when Math.random is 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(choice([10, 20, 30])).toBe(10);
  });

  it('returns the last element when Math.random is near 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(choice([10, 20, 30])).toBe(30);
  });
});
