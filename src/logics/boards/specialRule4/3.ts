import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [G, R, Y, R, B, G, Y, P],
    [B, P, P, H, W, Y, B, P],
    [R, R, R, G, G, G, Y, B],
    [B, B, B, R, R, R, P, B],
    [G, G, G, Y, Y, Y, R, B],
    [R, R, R, B, B, B, Y, P]
  ]
} as Board;
