import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [G, G, G, R, B, B, P, H],
    [B, R, P, G, Y, Y, H, P],
    [G, G, G, H, Y, R, H, P],
    [P, P, P, Y, R, G, B, P],
    [R, R, R, Y, R, G, Y, B],
    [B, B, B, G, Y, Y, G, G]
  ]
} as Board;
