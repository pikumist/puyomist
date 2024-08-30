import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, H, W, B, B, R, B, G],
    [G, G, Y, P, P, B, Y, G],
    [R, B, R, B, Y, Y, G, Y],
    [R, R, P, Y, B, P, G, Y],
    [B, B, B, R, R, B, R, R],
    [P, P, P, R, B, P, R, Y]
  ]
} as Board;
