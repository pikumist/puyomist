import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, B, G, P, R, P, Y, P],
    [B, P, B, H, W, R, G, P],
    [B, B, Y, Y, R, Y, P, G],
    [R, R, R, P, B, R, P, G],
    [P, P, B, G, P, B, Y, G],
    [B, P, B, G, G, B, B, Y]
  ]
} as Board;
