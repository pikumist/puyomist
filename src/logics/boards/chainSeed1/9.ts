import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, G, G, P, G, H, B, R],
    [P, R, B, P, Y, B, G, G],
    [R, B, P, H, B, G, R, G],
    [P, R, B, P, B, R, Y, R],
    [P, R, B, G, P, Y, H, Y],
    [P, Y, Y, Y, H, P, P, P]
  ]
} as Board;
