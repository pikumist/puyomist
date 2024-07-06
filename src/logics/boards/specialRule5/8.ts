import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, H, W, P, P, Y, P, R],
    [R, R, B, G, G, P, B, R],
    [Y, P, Y, P, B, B, R, B],
    [Y, Y, G, B, P, G, R, B],
    [P, P, P, Y, Y, P, Y, Y],
    [G, G, G, Y, P, G, Y, B]
  ]
} as Board;
