import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, H, H, Y, P, P, Y, P],
    [Y, Y, Y, P, H, H, Y, P],
    [R, B, G, B, P, G, R, R],
    [R, R, B, Y, G, Y, P, R],
    [B, B, G, G, Y, B, G, G],
    [Y, Y, Y, G, B, B, P, R]
  ]
} as Board;
