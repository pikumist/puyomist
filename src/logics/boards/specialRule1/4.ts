import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, P, Y, P, H, G, H, R],
    [P, R, G, R, Y, P, B, H],
    [G, G, Y, Y, B, B, R, R],
    [P, B, P, P, G, G, Y, P],
    [P, B, R, B, R, R, P, Y],
    [R, R, B, R, B, B, G, Y]
  ]
} as Board;
