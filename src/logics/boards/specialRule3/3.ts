import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, P, G, P, R, B, G, Y],
    [R, Y, Y, H, W, G, R, Y],
    [P, P, P, B, B, B, G, R],
    [R, R, R, P, P, P, Y, R],
    [B, B, B, G, G, G, P, R],
    [P, P, P, R, R, R, G, Y]
  ]
} as Board;
