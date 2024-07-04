import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [P, Y, Y, B, H, H, G, B],
    [H, P, P, P, B, B, B, G],
    [H, R, B, G, Y, P, R, G],
    [Y, R, B, G, Y, P, R, G],
    [Y, R, B, G, Y, P, R, B],
    [R, B, G, Y, P, R, B, B]
  ]
} as Board;
