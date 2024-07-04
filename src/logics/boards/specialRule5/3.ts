import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, B, P, B, G, Y, P, R],
    [G, R, R, H, W, P, G, R],
    [B, B, B, Y, Y, Y, P, G],
    [G, G, G, B, B, B, R, G],
    [Y, Y, Y, P, P, P, B, G],
    [B, B, B, G, G, G, P, R]
  ]
} as Board;
