import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, R, P, G, G, B, B, R],
    [R, P, G, R, P, B, R, R],
    [P, P, G, H, B, R, Y, Y],
    [R, Y, Y, W, B, Y, G, Y],
    [R, G, G, Y, R, P, P, P],
    [G, Y, R, R, B, G, G, G]
  ]
} as Board;
