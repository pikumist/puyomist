import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, B, R, G, R, W, P, R],
    [G, B, G, R, R, H, Y, Y],
    [B, Y, Y, G, G, P, P, P],
    [B, Y, P, R, R, G, B, R],
    [G, G, R, P, P, B, R, R],
    [G, P, R, G, G, G, B, B]
  ]
} as Board;
