import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, Y, B, R, R, B, B, B],
    [Y, B, W, H, B, R, P, P],
    [Y, Y, B, B, P, P, B, P],
    [G, P, Y, R, P, B, G, B],
    [G, G, P, Y, Y, P, P, B],
    [P, P, Y, R, R, G, G, G]
  ]
} as Board;
