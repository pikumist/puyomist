import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, Y, G, P, R, R, B, R],
    [G, P, Y, G, R, Y, R, G],
    [P, B, B, H, W, G, G, R],
    [P, R, R, G, P, R, Y, Y],
    [P, G, R, Y, P, R, G, Y],
    [G, R, Y, G, P, B, B, B]
  ]
} as Board;
