import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, G, R, P, P, R, R, R],
    [G, R, W, H, R, P, Y, Y],
    [G, G, R, R, Y, Y, R, Y],
    [B, Y, G, P, Y, R, B, R],
    [B, B, Y, G, G, Y, Y, R],
    [Y, Y, G, P, P, B, B, B]
  ]
} as Board;
