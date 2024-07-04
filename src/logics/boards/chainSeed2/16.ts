import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, G, Y, B, B, R, R, R],
    [Y, R, R, B, P, G, B, Y],
    [Y, Y, P, Y, H, H, H, H],
    [R, R, G, Y, P, Y, Y, Y],
    [P, P, B, Y, P, B, B, B],
    [G, G, Y, P, R, G, G, G]
  ]
} as Board;
