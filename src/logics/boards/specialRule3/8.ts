import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, H, W, G, G, B, G, Y],
    [Y, Y, P, R, R, G, P, Y],
    [B, G, B, G, P, P, Y, P],
    [B, B, R, P, G, R, Y, P],
    [G, G, G, B, B, G, B, B],
    [R, R, R, B, G, R, B, P]
  ]
} as Board;
