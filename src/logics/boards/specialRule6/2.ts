import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, R, Y, G, G, Y, Y, Y],
    [R, Y, W, H, Y, G, B, B],
    [R, R, Y, Y, B, B, Y, B],
    [P, B, R, G, B, Y, P, Y],
    [P, P, B, R, R, B, B, Y],
    [B, B, R, G, G, P, P, P]
  ]
} as Board;
