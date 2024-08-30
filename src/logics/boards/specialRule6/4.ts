import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [G, R, P, B, P, W, Y, P],
    [B, R, B, P, P, H, G, G],
    [R, G, G, B, B, Y, Y, Y],
    [R, G, Y, P, P, B, R, P],
    [B, B, P, Y, Y, R, P, P],
    [B, Y, P, B, B, B, R, R]
  ]
} as Board;
