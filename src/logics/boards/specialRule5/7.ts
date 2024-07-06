import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, P, Y, B, B, R, R, P],
    [P, Y, B, P, Y, R, P, P],
    [Y, Y, B, H, R, P, G, G],
    [P, G, G, W, R, G, B, G],
    [P, B, B, G, P, Y, Y, Y],
    [B, G, P, P, R, B, B, B]
  ]
} as Board;
