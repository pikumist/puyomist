import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, P, Y, R, B, B, G, B],
    [Y, R, P, Y, B, P, B, Y],
    [R, G, G, H, W, Y, Y, B],
    [R, B, B, Y, R, B, P, P],
    [R, Y, B, P, R, B, Y, P],
    [Y, B, P, Y, R, G, G, G]
  ]
} as Board;
