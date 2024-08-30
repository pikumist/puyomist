import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, R, B, Y, P, Y, G, Y],
    [R, Y, R, H, W, P, B, Y],
    [R, R, G, G, P, G, Y, B],
    [P, P, P, Y, R, P, Y, B],
    [Y, Y, R, B, Y, R, G, B],
    [R, Y, R, B, B, R, R, G]
  ]
} as Board;
