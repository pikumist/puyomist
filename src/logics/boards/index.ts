import type { Board } from '../Board';
import chainSeed1 from './chainSeed1';
import chainSeed2 from './chainSeed2';
import specialRule1 from './specialRule1';
import specialRule2 from './specialRule2';
import specialRule3 from './specialRule3';
import specialRule4 from './specialRule4';
import specialRule5 from './specialRule5';
import specialRule6 from './specialRule6';

const specialBoards = {
  chainSeed1,
  chainSeed2,
  specialRule1,
  specialRule2,
  specialRule3,
  specialRule4,
  specialRule5,
  specialRule6
};

export const possibleSpecialBoardIds = (() => {
  const boardIds: string[] = [];

  for (const boardKey of Object.keys(specialBoards)) {
    for (const n of Object.keys(
      specialBoards[boardKey as keyof typeof specialBoards]
    )) {
      boardIds.push(`${boardKey}/${n}`);
    }
  }

  return boardIds;
})();

export const getSpecialBoard = (boardId: string): Board => {
  const [ruleName, no] = boardId.split('/') as [
    keyof typeof specialBoards,
    string
  ];
  const board = specialBoards[ruleName][no as '1'];
  return board;
};

export const boardKeyNameMap = new Map<string, string>([
  ['chainSeed1', '連鎖のタネ1'],
  ['chainSeed2', '連鎖のタネ2'],
  ['specialRule1', 'あんりんスペエコ'],
  ['specialRule2', 'しろマール'],
  ['specialRule3', 'あたプー'],
  ['specialRule4', 'なつアマ'],
  ['specialRule5', 'キュアブイ'],
  ['specialRule6', '黄昏']
]);

export const customBoardId = 'custom';

export const boardIdToNameMap = new Map([
  [customBoardId, 'カスタム'],
  ...(possibleSpecialBoardIds.map((boardId) => {
    const [boardKey, no] = boardId.split('/');
    return [boardId, `${boardKeyNameMap.get(boardKey)}/${no}`];
  }) as [string, string][])
]);
