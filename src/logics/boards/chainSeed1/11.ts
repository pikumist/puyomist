import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, H, R, B, G, Y, Y, B],
    [P, B, B, H, R, Y, G, P],
    [R, R, B, R, B, P, B, G],
    [P, G, G, G, Y, B, P, G],
    [P, R, R, R, B, P, H, G],
    [P, Y, Y, Y, H, B, B, B]
  ]
} as Board;
