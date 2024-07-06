import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [H, G, G, P, R, R, H, H],
    [R, P, P, H, B, G, R, R],
    [G, G, P, B, R, B, P, Y],
    [R, B, Y, R, R, B, Y, Y],
    [R, R, Y, P, P, R, G, G],
    [B, B, B, Y, Y, P, G, Y]
  ]
} as Board;
