import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, P, Y, R, Y, W, G, Y],
    [R, P, R, Y, Y, H, B, B],
    [P, B, B, R, R, G, G, G],
    [P, B, G, Y, Y, R, P, Y],
    [R, R, Y, G, G, P, Y, Y],
    [R, G, Y, R, R, R, P, P]
  ]
} as Board;
