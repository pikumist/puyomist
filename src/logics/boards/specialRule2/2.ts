import type { Board } from '../../Board';
import { B, G, H, P, R, W, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [Y, P, G, B, B, G, G, G],
    [P, G, W, H, G, B, R, R],
    [P, P, G, G, R, R, G, R],
    [Y, R, P, B, R, G, Y, G],
    [Y, Y, R, P, P, R, R, G],
    [R, R, P, B, B, Y, Y, Y]
  ]
} as Board;
