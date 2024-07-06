import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [P, B, Y, Y, H, Y, G, G],
    [Y, H, B, P, Y, P, R, R],
    [B, G, Y, B, P, R, G, B],
    [G, R, G, R, B, G, B, H],
    [R, Y, P, R, B, P, B, G],
    [R, Y, R, P, P, G, R, G]
  ]
} as Board;
