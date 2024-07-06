import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, R, H, H, P, B, H, Y],
    [G, P, P, P, H, G, Y, P],
    [R, R, R, G, G, R, Y, P],
    [G, G, B, Y, R, G, P, Y],
    [G, P, P, R, Y, Y, P, B],
    [B, B, P, B, R, Y, B, B]
  ]
} as Board;
