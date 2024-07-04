import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [B, R, P, R, P, B, Y, P],
    [P, B, Y, Y, B, G, Y, B],
    [P, Y, B, G, R, W, H, R],
    [Y, G, G, P, G, Y, P, B],
    [P, P, G, B, G, Y, P, B],
    [B, R, R, P, B, G, P, B]
  ]
} as Board;
