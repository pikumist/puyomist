import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, G, B, G, B, Y, R, B],
    [B, Y, R, R, Y, P, R, Y],
    [B, R, Y, P, G, W, H, G],
    [R, P, P, B, P, R, B, Y],
    [B, B, P, Y, P, R, B, Y],
    [Y, G, G, B, Y, P, B, Y]
  ]
} as Board;
