import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [R, G, B, Y, G, H, P, H],
    [R, G, B, Y, G, B, R, H],
    [Y, Y, P, P, R, B, P, P],
    [P, P, R, R, H, R, P, R],
    [Y, R, G, B, Y, G, G, R],
    [Y, R, G, B, Y, B, B, R]
  ]
} as Board;
