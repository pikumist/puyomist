import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [H, R, P, B, H, P, G, Y],
    [R, Y, R, H, B, B, P, R],
    [B, B, G, B, P, P, G, G],
    [G, G, Y, Y, H, R, Y, G],
    [B, G, R, R, R, Y, Y, R],
    [B, R, Y, P, P, P, R, R]
  ]
} as Board;
