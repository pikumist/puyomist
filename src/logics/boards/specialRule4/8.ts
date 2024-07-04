import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, H, W, Y, Y, G, Y, P],
    [P, P, R, B, B, Y, R, P],
    [G, Y, G, Y, R, R, P, R],
    [G, G, B, R, Y, B, P, R],
    [Y, Y, Y, G, G, Y, G, G],
    [B, B, B, G, Y, B, G, R]
  ]
} as Board;
