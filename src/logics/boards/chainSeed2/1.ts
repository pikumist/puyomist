import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, H, Y, H, G, B, B, B],
    [R, H, G, G, H, P, G, G],
    [Y, Y, Y, G, R, G, P, B],
    [R, R, P, R, Y, R, G, P],
    [R, P, G, P, P, Y, R, P],
    [B, B, B, G, G, G, Y, Y]
  ]
} as Board;
