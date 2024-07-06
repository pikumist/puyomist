import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, G, Y, R, B, R, P, R],
    [G, R, G, H, W, B, Y, R],
    [G, G, P, P, B, P, R, Y],
    [B, B, B, R, G, B, R, Y],
    [R, R, G, Y, R, G, P, Y],
    [G, R, G, Y, Y, G, G, P]
  ]
} as Board;
