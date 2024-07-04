import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, Y, G, P, G, W, B, G],
    [P, Y, P, G, G, H, R, R],
    [Y, R, R, P, P, B, B, B],
    [Y, R, B, G, G, P, Y, G],
    [P, P, G, B, B, Y, G, G],
    [P, B, G, P, P, P, Y, Y]
  ]
} as Board;
