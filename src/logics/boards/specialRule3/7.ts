import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, G, B, P, P, Y, Y, G],
    [G, B, P, G, B, Y, G, G],
    [B, B, P, H, Y, G, R, R],
    [G, R, R, W, Y, R, P, R],
    [G, P, P, R, G, B, B, B],
    [P, R, G, G, Y, P, P, P]
  ]
} as Board;
