import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [H, H, P, Y, G, G, B, R],
    [R, P, P, Y, G, B, R, H],
    [P, Y, Y, G, B, B, R, R],
    [R, B, G, R, H, Y, P, Y],
    [R, R, G, R, R, P, Y, Y],
    [B, B, B, G, G, R, P, P]
  ]
} as Board;
