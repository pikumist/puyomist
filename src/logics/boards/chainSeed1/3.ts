import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, P, P, R, H, R, R, G],
    [P, B, B, B, R, H, H, Y],
    [P, R, G, Y, P, B, P, H],
    [R, G, Y, P, B, P, G, Y],
    [R, G, Y, P, B, P, G, Y],
    [R, G, Y, P, B, P, G, Y]
  ]
} as Board;
