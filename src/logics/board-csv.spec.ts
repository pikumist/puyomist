import { describe, expect, it } from 'vitest';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import { PuyoType } from './PuyoType';
import { parseBoardCsv, parseBoardCsvCell, toBoardCsv } from './board-csv';

describe('board-csv', () => {
  describe('parseBoardCsvCell()', () => {
    it.each([
      { cell: 'R', type: PuyoType.Red },
      { cell: 'R+', type: PuyoType.RedPlus },
      { cell: 'Rc', type: PuyoType.RedChance },
      { cell: 'Rc+', type: PuyoType.RedChancePlus },
      { cell: 'B', type: PuyoType.Blue },
      { cell: 'B+', type: PuyoType.BluePlus },
      { cell: 'Bc', type: PuyoType.BlueChance },
      { cell: 'Bc+', type: PuyoType.BlueChancePlus },
      { cell: 'G', type: PuyoType.Green },
      { cell: 'G+', type: PuyoType.GreenPlus },
      { cell: 'Gc', type: PuyoType.GreenChance },
      { cell: 'Gc+', type: PuyoType.GreenChancePlus },
      { cell: 'Y', type: PuyoType.Yellow },
      { cell: 'Y+', type: PuyoType.YellowPlus },
      { cell: 'Yc', type: PuyoType.YellowChance },
      { cell: 'Yc+', type: PuyoType.YellowChancePlus },
      { cell: 'P', type: PuyoType.Purple },
      { cell: 'P+', type: PuyoType.PurplePlus },
      { cell: 'Pc', type: PuyoType.PurpleChance },
      { cell: 'Pc+', type: PuyoType.PurpleChancePlus },
      { cell: 'H', type: PuyoType.Heart },
      { cell: 'W', type: PuyoType.Prism },
      { cell: 'O', type: PuyoType.Ojama },
      { cell: 'K', type: PuyoType.Kata },
      { cell: 'Z', type: PuyoType.Padding },
      { cell: '_', type: undefined },
      { cell: '', type: undefined },
      { cell: '不正', type: PuyoType.Padding }
    ])('should return a proper PuyoType or undefined', ({ cell, type }) => {
      expect(parseBoardCsvCell(cell)).toBe(type);
    });
  });

  describe('parseCsv()', () => {
    const R = PuyoType.Red;
    const B = PuyoType.Blue;
    const G = PuyoType.Green;
    const Y = PuyoType.Yellow;
    const P = PuyoType.Purple;
    const H = PuyoType.Heart;
    const W = PuyoType.Prism;

    it.each([
      {
        csv: `B,B,B,B,B,B,B,B
Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`,
        board: {
          nextPuyos: [B, B, B, B, B, B, B, B],
          field: [
            [Y, P, R, G, Y, G, B, G],
            [P, G, P, H, W, Y, R, G],
            [P, P, B, B, Y, B, G, R],
            [Y, Y, Y, G, P, Y, G, R],
            [G, G, P, R, G, P, B, R],
            [P, G, P, R, R, P, P, B]
          ]
        }
      }
    ])('should return a proper Board if everything is ok', ({ csv, board }) => {
      expect(parseBoardCsv(csv)).toEqual(board);
    });

    it.each([
      {
        csv: `Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`,
        error: '行数が7でない'
      },
      {
        csv: `B,B,B,B
Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`,
        error: '列数が8でない'
      }
    ])(
      'should return an error message if something is wrong',
      ({ csv, error }) => {
        expect(parseBoardCsv(csv)).toBe(error);
      }
    );
  });

  describe('toBoardCsv()', () => {
    it('should convert simulation data to csv', () => {
      // Arrange
      const R = PuyoType.Red;
      const B = PuyoType.Blue;
      const G = PuyoType.Green;
      const Y = PuyoType.Yellow;
      const P = PuyoType.Purple;
      const H = PuyoType.Heart;
      const W = PuyoType.Prism;
      const simulationData = createSimulationData({
        nextPuyos: [B, B, B, B, B, B, B, B],
        field: [
          [Y, P, R, G, Y, G, B, G],
          [P, G, P, H, W, Y, R, G],
          [P, P, B, B, Y, B, G, R],
          [Y, Y, Y, G, P, Y, G, R],
          [G, G, P, R, G, P, B, R],
          [P, G, P, R, R, P, P, B]
        ]
      });

      // Act
      const actual = toBoardCsv(simulationData);

      // Assert
      expect(actual.trim().replaceAll('\r\n', '\n')).toBe(`B,B,B,B,B,B,B,B
Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`);
    });
  });
});
