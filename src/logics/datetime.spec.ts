import { describe, expect, it } from 'vitest';
import { formatDuration } from './datetime';

describe('datetime', () => {
  describe('formatDuration()', () => {
    it.each([
      { ms: 123, expected: '0.123s' },
      { ms: 1234, expected: '1.234s' },
      { ms: 987654, expected: '16m27s' },
      { ms: 67898765, expected: '18h51m38s' }
    ])(
      'should format milliseconds according to its time scale',
      ({ ms, expected }) => {
        // Act
        const actual = formatDuration(ms);

        // Assert
        expect(actual).toBe(expected);
      }
    );
  });
});
