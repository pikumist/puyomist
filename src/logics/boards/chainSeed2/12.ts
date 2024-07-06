import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, B, H, P, Y, Y, P, Y],
    [Y, P, P, Y, H, H, H, G],
    [B, B, G, P, Y, P, B, G],
    [B, Y, Y, R, P, G, G, B],
    [G, G, Y, P, R, R, R, B],
    [G, R, R, R, Y, Y, Y, B]
  ]
} as Board;
