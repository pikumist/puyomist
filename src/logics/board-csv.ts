import type { Board } from './Board';
import { PuyoAttr } from './PuyoAttr';
import { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';

const empty = Symbol('empty');
const firstCharMap = new Map<
  string | undefined,
  PuyoType | PuyoAttr | typeof empty
>([
  ['R', PuyoAttr.Red],
  ['B', PuyoAttr.Blue],
  ['G', PuyoAttr.Green],
  ['Y', PuyoAttr.Yellow],
  ['P', PuyoAttr.Purple],
  ['H', PuyoType.Heart],
  ['W', PuyoType.Prism],
  ['O', PuyoType.Ojama],
  ['K', PuyoType.Kata],
  ['Z', PuyoType.Padding],
  ['_', empty],
  [undefined, empty]
]);

export const parseBoardCsvCell = (cell: string): PuyoType | undefined => {
  const head = firstCharMap.get(cell[0]);
  if (!head) {
    return PuyoType.Padding;
  }
  if (head === empty) {
    return undefined;
  }
  switch (head) {
    case PuyoAttr.Red:
    case PuyoAttr.Blue:
    case PuyoAttr.Green:
    case PuyoAttr.Yellow:
    case PuyoAttr.Purple: {
      const hasChance = cell.includes('c') ? 2 : 0;
      const hasPlus = cell.includes('+') ? 1 : 0;
      return (1 + (head - 1) * 4 + hasChance + hasPlus) as PuyoType;
    }
    default:
      return head as PuyoType;
  }
};

export const parseBoardCsv = (csvText: string): Board | string => {
  const rows = csvText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length !== 7) {
    return '行数が7でない';
  }

  const board = {
    field: [[], [], [], [], [], []] as (PuyoType | undefined)[][],
    nextPuyos: [] as (PuyoType | undefined)[]
  } satisfies Board;

  for (const [i, row] of rows.entries()) {
    const cells = row.split(',').map((cell) => cell.trim());
    if (cells.length !== 8) {
      return '列数が8でない';
    }
    if (i === 0) {
      for (const cell of cells) {
        board.nextPuyos.push(parseBoardCsvCell(cell));
      }
    } else {
      for (const cell of cells) {
        board.field[i - 1].push(parseBoardCsvCell(cell));
      }
    }
  }

  return board;
};

const puyoTypeToStringMap = new Map<PuyoType | undefined, string>([
  [PuyoType.Red, 'R'],
  [PuyoType.RedPlus, 'R+'],
  [PuyoType.RedChance, 'Rc'],
  [PuyoType.RedChancePlus, 'Rc+'],
  [PuyoType.Blue, 'B'],
  [PuyoType.BluePlus, 'B+'],
  [PuyoType.BlueChance, 'Bc'],
  [PuyoType.BlueChancePlus, 'Bc+'],
  [PuyoType.Green, 'G'],
  [PuyoType.GreenPlus, 'G+'],
  [PuyoType.GreenChance, 'Gc'],
  [PuyoType.GreenChancePlus, 'Gc+'],
  [PuyoType.Yellow, 'Y'],
  [PuyoType.YellowPlus, 'Y+'],
  [PuyoType.YellowChance, 'Yc'],
  [PuyoType.YellowChancePlus, 'Yc+'],
  [PuyoType.Purple, 'P'],
  [PuyoType.PurplePlus, 'P+'],
  [PuyoType.PurpleChancePlus, 'Pc+'],
  [PuyoType.Heart, 'H'],
  [PuyoType.Prism, 'W'],
  [PuyoType.Ojama, 'O'],
  [PuyoType.Kata, 'K'],
  [PuyoType.Padding, 'Z'],
  [undefined, '_']
]);

export const toBoardCsv = (
  simulationData: Pick<SimulationData, 'field' | 'nextPuyos'>
): string => {
  const { nextPuyos, field } = simulationData;
  const rows: string[] = [];

  rows.push(
    nextPuyos.map((cell) => puyoTypeToStringMap.get(cell?.type)).join(',')
  );
  for (const row of field) {
    rows.push(row.map((cell) => puyoTypeToStringMap.get(cell?.type)).join(','));
  }

  return rows.join('\r\n');
};
