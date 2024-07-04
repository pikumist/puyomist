import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, P, R, R, H, B, H, H],
    [P, H, P, P, R, R, B, Y],
    [R, B, G, B, Y, G, B, B],
    [R, B, G, B, Y, G, P, Y],
    [B, G, B, Y, G, P, Y, Y],
    [R, B, G, B, Y, G, P, P]
  ]
} as Board;
