import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, G, B, R, P, B, H, B],
    [P, Y, B, R, Y, P, Y, P],
    [H, P, P, B, R, R, Y, P],
    [Y, G, Y, G, P, G, R, B],
    [Y, G, Y, G, R, Y, B, H],
    [G, Y, G, P, G, G, P, B]
  ]
} as Board;
