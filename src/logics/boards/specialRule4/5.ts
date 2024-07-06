import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, P, Y, P, Y, R, G, Y],
    [Y, R, G, G, R, B, G, R],
    [Y, G, R, B, P, W, H, P],
    [G, B, B, Y, B, G, Y, R],
    [Y, Y, B, R, B, G, Y, R],
    [R, P, P, Y, R, B, Y, R]
  ]
} as Board;
