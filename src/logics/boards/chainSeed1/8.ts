import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, B, H, G, Y, G, P, Y],
    [Y, Y, B, B, H, Y, Y, P],
    [Y, H, Y, P, G, Y, P, P],
    [R, G, R, B, P, P, R, P],
    [R, R, G, R, R, R, Y, Y],
    [G, G, P, B, B, B, G, Y]
  ]
} as Board;
