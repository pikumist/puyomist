import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, R, H, Y, H, G, B, P],
    [P, Y, Y, B, G, B, G, P],
    [R, R, Y, H, Y, R, Y, P],
    [R, B, G, R, B, Y, P, Y],
    [P, P, B, G, G, Y, G, Y],
    [B, B, G, R, R, Y, R, Y]
  ]
} as Board;
