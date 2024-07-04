import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, P, P, H, G, Y, G, G],
    [G, B, G, P, Y, H, H, H],
    [G, G, R, Y, Y, B, G, G],
    [R, R, B, R, G, G, B, P],
    [R, B, R, Y, G, Y, B, B],
    [B, R, R, Y, Y, P, P, P]
  ]
} as Board;
