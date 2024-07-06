import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, B, R, H, P, H, B, B],
    [B, R, P, P, H, R, R, B],
    [B, B, R, R, P, G, P, P],
    [Y, P, G, Y, H, R, B, P],
    [Y, Y, P, G, R, Y, G, G],
    [G, G, P, P, Y, Y, G, P]
  ]
} as Board;
