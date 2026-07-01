import { describe, expect, it } from 'vitest';
import { PuyoCoord } from './PuyoCoord';

describe('PuyoCoord', () => {
  it('toCellAddr converts x/y to a cell address string', () => {
    expect(PuyoCoord.xyToCoord(0, 0)?.toCellAddr()).toBe('A1');
    expect(PuyoCoord.xyToCoord(1, 2)?.toCellAddr()).toBe('B3');
    expect(PuyoCoord.xyToCoord(7, 5)?.toCellAddr()).toBe('H6');
  });

  it('xyToCoord returns undefined for out-of-range coordinates', () => {
    expect(PuyoCoord.xyToCoord(-1, 0)).toBeUndefined();
    expect(PuyoCoord.xyToCoord(0, -1)).toBeUndefined();
    expect(PuyoCoord.xyToCoord(8, 0)).toBeUndefined();
    expect(PuyoCoord.xyToCoord(0, 6)).toBeUndefined();
  });

  it('xyToCoord returns the same immutable instance for the same coordinates', () => {
    expect(PuyoCoord.xyToCoord(3, 4)).toBe(PuyoCoord.xyToCoord(3, 4));
  });

  it('cellAddrToCoord converts a cell address string back to a coord', () => {
    const coord = PuyoCoord.cellAddrToCoord('B3');
    expect(coord?.x).toBe(1);
    expect(coord?.y).toBe(2);
  });

  it('cellAddrToCoord returns undefined for empty or malformed input', () => {
    expect(PuyoCoord.cellAddrToCoord('')).toBeUndefined();
    expect(PuyoCoord.cellAddrToCoord('A')).toBeUndefined();
    expect(PuyoCoord.cellAddrToCoord('A12')).toBeUndefined();
  });

  it('cellAddrToCoord returns undefined when the resulting xy is out of range', () => {
    expect(PuyoCoord.cellAddrToCoord('Z9')).toBeUndefined();
  });

  it('indexToCoord converts a 1-D index back to a coord', () => {
    const coord = PuyoCoord.indexToCoord(9);
    expect(coord?.x).toBe(1);
    expect(coord?.y).toBe(1);
    expect(coord?.index).toBe(9);
  });

  it('indexToCoord returns undefined for an invalid index', () => {
    expect(PuyoCoord.indexToCoord(-1)).toBeUndefined();
    expect(PuyoCoord.indexToCoord(48)).toBeUndefined();
  });

  it('isValidIndex validates the index range', () => {
    expect(PuyoCoord.isValidIndex(undefined)).toBe(false);
    expect(PuyoCoord.isValidIndex(-1)).toBe(false);
    expect(PuyoCoord.isValidIndex(0)).toBe(true);
    expect(PuyoCoord.isValidIndex(47)).toBe(true);
    expect(PuyoCoord.isValidIndex(48)).toBe(false);
  });

  it('isValidXy validates the x/y range', () => {
    expect(PuyoCoord.isValidXy(0, 0)).toBe(true);
    expect(PuyoCoord.isValidXy(7, 5)).toBe(true);
    expect(PuyoCoord.isValidXy(-1, 0)).toBe(false);
    expect(PuyoCoord.isValidXy(0, -1)).toBe(false);
    expect(PuyoCoord.isValidXy(8, 0)).toBe(false);
    expect(PuyoCoord.isValidXy(0, 6)).toBe(false);
  });

  it('adjacentPuyoCoords returns all 8 neighbors for a middle coord', () => {
    const center = PuyoCoord.xyToCoord(3, 3)!;
    const neighbors = PuyoCoord.adjacentPuyoCoords(center);
    expect(neighbors).toHaveLength(8);
    const addrs = neighbors.map((c) => c.toCellAddr()).sort();
    expect(addrs).toEqual(
      ['C3', 'C5', 'D3', 'D5', 'E3', 'E4', 'E5', 'C4'].sort()
    );
  });

  it('adjacentPuyoCoords filters out-of-range neighbors for a corner coord', () => {
    const corner = PuyoCoord.xyToCoord(0, 0)!;
    const neighbors = PuyoCoord.adjacentPuyoCoords(corner);
    // Only right, bottom, bottom-right are in range.
    expect(neighbors).toHaveLength(3);
    const addrs = neighbors.map((c) => c.toCellAddr()).sort();
    expect(addrs).toEqual(['A2', 'B1', 'B2'].sort());
  });
});
