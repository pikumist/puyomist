import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, Y, B, P, P, G, R, H],
    [H, R, Y, Y, P, G, R, Y],
    [R, Y, B, B, B, P, G, R],
    [R, Y, H, G, Y, Y, G, R],
    [G, G, G, B, P, Y, P, Y],
    [B, B, B, Y, P, P, Y, Y]
  ]
} as Board;
