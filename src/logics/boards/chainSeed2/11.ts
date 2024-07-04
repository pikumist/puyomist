import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, G, R, G, B, B, R, Y],
    [P, Y, G, B, G, P, B, R],
    [P, P, R, H, H, Y, Y, R],
    [R, R, B, H, H, P, Y, R],
    [P, R, Y, B, B, G, P, B],
    [G, Y, Y, R, R, R, G, P]
  ]
} as Board;
