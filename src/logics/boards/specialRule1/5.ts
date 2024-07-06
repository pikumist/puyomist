import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [B, H, G, P, R, B, Y, B],
    [H, G, R, G, P, R, Y, G],
    [Y, R, Y, Y, G, P, B, G],
    [P, Y, G, G, Y, Y, R, Y],
    [R, B, R, Y, G, P, P, G],
    [B, H, B, R, R, G, G, P]
  ]
} as Board;
