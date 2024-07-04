import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, G, P, R, Y, B, H, Y],
    [G, R, R, B, B, H, H, B],
    [G, B, P, G, Y, R, P, Y],
    [Y, Y, B, P, G, Y, R, P],
    [P, B, R, G, B, R, G, P],
    [R, R, B, B, G, G, Y, Y]
  ]
} as Board;
