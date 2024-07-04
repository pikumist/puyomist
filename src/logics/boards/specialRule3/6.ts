import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, R, P, B, G, G, Y, G],
    [P, B, R, P, G, R, G, P],
    [B, Y, Y, H, W, P, P, G],
    [B, G, G, P, B, G, R, R],
    [B, P, G, R, B, G, P, R],
    [P, G, R, P, B, Y, Y, Y]
  ]
} as Board;
