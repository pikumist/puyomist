import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, Y, G, Y, G, P, B, G],
    [G, P, B, B, P, R, B, P],
    [G, B, P, R, Y, W, H, Y],
    [B, R, R, G, R, B, G, P],
    [G, G, R, P, R, B, G, P],
    [P, Y, Y, G, P, R, G, P]
  ]
} as Board;
