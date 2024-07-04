import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, G, P, H, H, R, H, B],
    [B, G, P, B, R, H, B, B],
    [P, P, B, R, R, B, P, P],
    [G, G, R, B, B, P, Y, P],
    [B, Y, R, R, G, Y, G, Y],
    [B, B, Y, Y, R, G, G, Y]
  ]
} as Board;
