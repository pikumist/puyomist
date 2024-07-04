import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, P, R, H, B, H, Y, Y],
    [P, R, B, B, H, Y, B, G],
    [P, P, R, R, B, G, G, Y],
    [B, G, Y, P, H, R, G, B],
    [B, B, G, Y, P, P, R, B],
    [G, G, Y, Y, P, R, R, B]
  ]
} as Board;
