import { describe, expect, it, vi } from 'vitest';
import { sleep } from './sleep';

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    vi.useFakeTimers();
    let done = false;
    const p = sleep(100).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
