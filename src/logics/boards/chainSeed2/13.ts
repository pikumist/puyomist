import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [H, G, G, G, P, P, R, G],
    [G, Y, Y, H, H, H, P, P],
    [Y, R, P, B, G, R, R, R],
    [Y, R, P, B, G, Y, B, G],
    [R, P, B, G, Y, B, G, G],
    [R, P, B, G, Y, Y, B, B]
  ]
} as Board;
