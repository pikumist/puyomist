import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, B, R, Y, Y, G, G, B],
    [B, R, Y, B, R, G, B, B],
    [R, R, Y, H, G, B, P, P],
    [B, P, P, W, G, P, Y, P],
    [B, Y, Y, P, B, R, R, R],
    [Y, P, B, B, G, Y, Y, Y]
  ]
} as Board;
