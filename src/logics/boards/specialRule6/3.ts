import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, Y, B, Y, P, R, B, G],
    [P, G, G, H, W, B, P, G],
    [Y, Y, Y, R, R, R, B, P],
    [P, P, P, Y, Y, Y, G, P],
    [R, R, R, B, B, B, Y, P],
    [Y, Y, Y, P, P, P, B, G]
  ]
} as Board;
