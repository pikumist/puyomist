import type { Board } from './Board';
import type { BoardEditMode } from './BoardEditMode';
import {
  AllClearPreference,
  ChancePopPreference,
  OptimizationCategory,
  type OptimizationTarget
} from './OptimizationTarget';
import { SolutionMethod } from './solution';

export class Session {
  private static readonly boardIdKey = 'boardId';
  private static readonly nextSelectionKey = 'nextSelection';
  private static readonly maxTraceNumKey = 'maxTraceNum';
  private static readonly poppingLeverageKey = 'poppingLeverage';
  private static readonly animationDurationKey = 'animationDuration';
  private static readonly optimizationTargetKey = 'optimizationTarget';
  private static readonly solutionMethodKey = 'solutionMethod';
  private static readonly lastScreenshotBoardKey = 'lastScreenshotBoard';
  private static readonly boostAreaKeyListKey = 'boostAreaKeys';
  private static readonly boardEditModeKey = 'boardEidtMode';

  storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  getBoardId(): string {
    return this.storage.getItem(Session.boardIdKey) || 'chainSeed1/1';
  }

  setBoardId(boardId: string): void {
    this.storage.setItem(Session.boardIdKey, boardId);
  }

  getNextSelection(): string {
    return this.storage.getItem(Session.nextSelectionKey) || 'random';
  }

  setNextSelection(nextSelection: string): void {
    this.storage.setItem(Session.nextSelectionKey, nextSelection);
  }

  getMaxTraceNum(): number {
    const maxTraceNum = this.storage.getItem(Session.maxTraceNumKey) || '5';
    return Number.parseInt(maxTraceNum, 10);
  }

  setMaxTraceNum(maxTraceNum: number): void {
    this.storage.setItem(Session.maxTraceNumKey, String(maxTraceNum));
  }

  getPoppingLeverage(): number {
    const poppingLeverage =
      this.storage.getItem(Session.poppingLeverageKey) || '1.0';
    return Number.parseFloat(poppingLeverage);
  }

  setPoppingLeverage(leverage: number): void {
    this.storage.setItem(Session.poppingLeverageKey, String(leverage));
  }

  getAnimationDuration(): number {
    const animationDuration =
      this.storage.getItem(Session.animationDurationKey) || '200';
    return Number.parseInt(animationDuration, 10);
  }

  setAnimationDuration(duration: number): void {
    this.storage.setItem(Session.animationDurationKey, String(duration));
  }

  getOptimizationTarget(): OptimizationTarget {
    const targetStr = this.storage.getItem(Session.optimizationTargetKey);
    try {
      return JSON.parse(targetStr!);
    } catch (_) {
      return {
        allClearPreference: AllClearPreference.PreferIfBestValue,
        chancePopPreference: ChancePopPreference.PreferIfBestValue,
        category: OptimizationCategory.PuyotsukaiCount
      };
    }
  }

  setOptimizationTarget(tareget: OptimizationTarget): void {
    this.storage.setItem(
      Session.optimizationTargetKey,
      JSON.stringify(tareget)
    );
  }

  getSolutionMethod(): SolutionMethod {
    const solutionMethod =
      this.storage.getItem(Session.solutionMethodKey) ||
      SolutionMethod.solveAllInParallel;
    return solutionMethod as SolutionMethod;
  }

  setSolutionMethod(solutionMethod: SolutionMethod): void {
    this.storage.setItem(Session.solutionMethodKey, String(solutionMethod));
  }

  getLastScreenshotBoard(): Board | undefined {
    const boardStr = this.storage.getItem(Session.lastScreenshotBoardKey);
    if (!boardStr) {
      return undefined;
    }
    return JSON.parse(boardStr);
  }

  setLastScreenshotBoard(board: Board | undefined): void {
    this.storage.setItem(
      Session.lastScreenshotBoardKey,
      board ? JSON.stringify(board) : ''
    );
  }

  getBoostAreaKeyList(): string[] {
    const boostAreaKeyListStr = this.storage.getItem(
      Session.boostAreaKeyListKey
    );
    if (!boostAreaKeyListStr) {
      return [];
    }
    return JSON.parse(boostAreaKeyListStr);
  }

  setBoostAreaKeyList(boostAreaKeyList: string[]): void {
    this.storage.setItem(
      Session.boostAreaKeyListKey,
      JSON.stringify(boostAreaKeyList)
    );
  }

  getBoardEditMode(): BoardEditMode | undefined {
    const boardEditModeStr = this.storage.getItem(Session.boardEditModeKey);
    if (!boardEditModeStr) {
      return undefined;
    }
    return JSON.parse(boardEditModeStr);
  }

  setBoardEditMode(boardEditMode: BoardEditMode | undefined): void {
    if (boardEditMode) {
      this.storage.setItem(
        Session.boardEditModeKey,
        JSON.stringify(boardEditMode)
      );
    } else {
      this.storage.removeItem(Session.boardEditModeKey);
    }
  }
}

export const session = new Session(localStorage);
