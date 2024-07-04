import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, B, R, B, R, G, P, R],
    [R, G, P, P, G, Y, P, G],
    [R, P, G, Y, B, W, H, B],
    [P, Y, Y, R, Y, P, R, G],
    [R, R, Y, G, Y, P, R, G],
    [G, B, B, R, G, Y, R, G]
  ]
} as Board;
