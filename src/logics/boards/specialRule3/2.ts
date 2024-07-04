import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, B, P, Y, Y, P, P, P],
    [B, P, W, H, P, Y, G, G],
    [B, B, P, P, G, G, P, G],
    [R, G, B, Y, G, P, R, P],
    [R, R, G, B, B, G, G, P],
    [G, G, B, Y, Y, R, R, R]
  ]
} as Board;
