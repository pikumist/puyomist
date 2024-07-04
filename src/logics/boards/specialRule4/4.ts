import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, G, B, Y, B, W, R, B],
    [Y, G, Y, B, B, H, P, P],
    [G, P, P, Y, Y, R, R, R],
    [G, P, R, B, B, Y, G, B],
    [Y, Y, B, R, R, G, B, B],
    [Y, R, B, Y, Y, Y, G, G]
  ]
} as Board;
