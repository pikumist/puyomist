import type { Board } from '../../Board';
import { B, G, H, P, R, Y } from '../alias';
import base from './base';

export default {
  ...base,
  field: [
    [H, Y, H, H, R, B, B, G],
    [P, Y, R, G, H, R, R, R],
    [P, Y, B, P, P, G, B, B],
    [Y, P, G, G, G, P, Y, G],
    [R, P, B, B, B, P, G, G],
    [R, R, G, G, G, Y, Y, Y]
  ]
} as Board;
