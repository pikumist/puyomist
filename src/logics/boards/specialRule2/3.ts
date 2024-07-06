import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, G, R, G, Y, P, R, B],
    [Y, B, B, H, W, R, Y, B],
    [G, G, G, P, P, P, R, Y],
    [Y, Y, Y, G, G, G, B, Y],
    [P, P, P, R, R, R, G, Y],
    [G, G, G, Y, Y, Y, R, B]
  ]
} as Board;
