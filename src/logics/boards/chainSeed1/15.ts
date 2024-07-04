import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  matrix: [
    [G, Y, Y, P, B, B, B, G],
    [P, P, P, B, G, G, G, H],
    [Y, Y, R, G, R, R, R, H],
    [G, G, G, Y, B, B, B, R],
    [H, R, R, R, P, P, P, B],
    [H, Y, Y, Y, G, G, G, P]
  ]
} as Board;
