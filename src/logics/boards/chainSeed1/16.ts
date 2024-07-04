import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, P, H, Y, B, B, R, H],
    [G, Y, Y, B, H, B, Y, R],
    [P, P, P, Y, P, P, Y, R],
    [G, G, R, G, B, P, Y, R],
    [G, B, B, R, G, B, P, Y],
    [B, R, R, G, G, B, B, Y]
  ]
} as Board;
