import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, Y, G, R, R, P, P, Y],
    [Y, G, R, Y, G, P, Y, Y],
    [G, G, R, H, P, Y, B, B],
    [Y, B, B, W, P, B, R, B],
    [Y, R, R, B, Y, G, G, G],
    [R, B, Y, Y, P, G, G, G]
  ]
} as Board;
