import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [G, Y, P, B, G, B, R, B],
    [Y, B, Y, H, W, G, P, B],
    [Y, Y, R, R, G, R, B, P],
    [G, G, G, B, Y, G, B, P],
    [B, B, Y, P, B, Y, R, P],
    [Y, B, Y, P, P, Y, Y, R]
  ]
} as Board;
