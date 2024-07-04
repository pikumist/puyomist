import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [Y, R, G, G, B, P, Y, G],
    [R, G, B, R, R, B, B, B],
    [Y, H, Y, H, R, P, P, G],
    [H, Y, H, Y, P, Y, G, G],
    [R, G, B, B, B, Y, P, P],
    [R, Y, Y, Y, R, P, Y, P]
  ]
} as Board;
