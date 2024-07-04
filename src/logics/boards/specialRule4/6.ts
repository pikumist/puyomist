import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, B, R, G, Y, Y, P, Y],
    [R, G, B, R, Y, B, Y, R],
    [G, P, P, H, W, R, R, Y],
    [G, Y, Y, R, G, Y, B, B],
    [G, R, Y, B, G, Y, R, B],
    [R, Y, B, R, G, P, P, P]
  ]
} as Board;
