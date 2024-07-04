import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, P, R, B, R, Y, G, B],
    [P, G, B, P, Y, B, G, B],
    [P, Y, R, B, R, Y, Y, R],
    [H, H, P, G, B, P, R, Y],
    [Y, G, P, G, B, P, R, H],
    [G, R, G, R, P, G, B, Y]
  ]
} as Board;
