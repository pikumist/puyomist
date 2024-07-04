import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, Y, B, P, P, P, H, P],
    [Y, P, G, B, B, B, P, H],
    [Y, P, G, Y, R, G, B, H],
    [P, G, Y, R, G, B, P, H],
    [Y, P, G, Y, R, G, B, P],
    [R, R, R, Y, R, G, B, P]
  ]
} as Board;
