import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [R, H, P, H, B, G, B, Y],
    [B, B, P, Y, B, G, B, H],
    [P, P, B, B, G, B, G, Y],
    [B, G, G, Y, R, B, Y, Y],
    [B, R, H, Y, P, R, R, R],
    [R, R, G, G, Y, P, P, P]
  ]
} as Board;
