import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, G, B, Y, P, P, R, P],
    [B, Y, G, B, P, G, P, B],
    [Y, R, R, H, W, B, B, P],
    [Y, P, P, B, Y, P, G, G],
    [Y, B, P, G, Y, P, B, G],
    [B, P, G, B, Y, R, R, R]
  ]
} as Board;
