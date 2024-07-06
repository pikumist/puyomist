import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, H, G, P, P, B, R, H],
    [R, R, H, G, G, P, Y, G],
    [G, G, R, G, P, B, B, B],
    [G, P, G, Y, B, Y, Y, Y],
    [Y, Y, Y, B, R, R, G, G],
    [P, P, P, Y, B, B, R, G]
  ]
} as Board;
