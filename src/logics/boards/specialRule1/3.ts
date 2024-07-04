import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, R, B, Y, P, R, P, H],
    [B, Y, P, R, B, G, Y, G],
    [B, Y, P, R, B, G, Y, G],
    [Y, P, R, B, G, Y, G, H],
    [B, R, B, Y, P, R, P, H],
    [G, G, R, B, Y, P, R, P]
  ]
} as Board;
