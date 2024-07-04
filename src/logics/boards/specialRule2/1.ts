import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, P, R, G, Y, G, B, G],
    [P, G, P, H, W, Y, R, G],
    [P, P, B, B, Y, B, G, R],
    [Y, Y, Y, G, P, Y, G, R],
    [G, G, P, R, G, P, B, R],
    [P, G, P, R, R, P, P, B]
  ]
} as Board;
