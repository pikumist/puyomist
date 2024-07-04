import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, P, H, P, Y, G, Y, Y],
    [R, Y, P, H, Y, G, P, G],
    [B, Y, G, B, H, Y, G, P],
    [B, R, B, R, P, B, R, P],
    [Y, G, P, P, R, B, G, G],
    [B, G, B, R, B, Y, R, R]
  ]
} as Board;
