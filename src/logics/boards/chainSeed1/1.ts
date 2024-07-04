import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, H, H, R, R, G, P, B],
    [R, R, P, H, H, R, G, G],
    [G, G, R, Y, R, G, P, P],
    [G, Y, G, B, Y, Y, R, P],
    [B, B, B, R, R, R, Y, B],
    [Y, Y, Y, P, P, P, B, B]
  ]
} as Board;
