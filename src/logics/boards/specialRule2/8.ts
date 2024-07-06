import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, H, W, R, R, P, R, B],
    [B, B, G, Y, Y, R, G, B],
    [P, R, P, R, G, G, B, G],
    [P, P, Y, G, R, Y, B, G],
    [R, R, R, P, P, R, P, P],
    [Y, Y, Y, P, R, Y, P, G]
  ]
} as Board;
