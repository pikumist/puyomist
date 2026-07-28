import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from './Board';
import { HowToEditBoard } from './BoardEditMode';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import { TraceMode } from './TraceMode';
import { PaintPrecision, defaultPaintSearchSettings } from './paint-search';
import { defaultPlusAssignSettings } from './plus-assign';
import { Session, session } from './session';
import { SolutionMethod } from './solution';

describe('Session', () => {
  let storage: Storage;
  let s: Session;

  beforeEach(() => {
    localStorage.clear();
    storage = localStorage;
    s = new Session(storage);
  });

  it('exports a default session bound to localStorage', () => {
    expect(session).toBeInstanceOf(Session);
  });

  it('clear empties the storage', () => {
    s.setBoardId('foo');
    s.clear();
    expect(s.getBoardId()).toBe('chainSeed1/1');
  });

  it('boardId getter falls back to default and round-trips', () => {
    expect(s.getBoardId()).toBe('chainSeed1/1');
    s.setBoardId('chainSeed3/2');
    expect(s.getBoardId()).toBe('chainSeed3/2');
  });

  it('nextSelection getter falls back to random and round-trips', () => {
    expect(s.getNextSelection()).toBe('random');
    s.setNextSelection('red');
    expect(s.getNextSelection()).toBe('red');
  });

  it('traceMode falls back to Normal for unknown values and round-trips', () => {
    expect(s.getTraceMode()).toBe(TraceMode.Normal);
    storage.setItem('traceMode', '999');
    expect(s.getTraceMode()).toBe(TraceMode.Normal);
    s.setTraceMode(TraceMode.ToBlue);
    expect(s.getTraceMode()).toBe(TraceMode.ToBlue);
  });

  it('maxTraceNum falls back to 5 and round-trips', () => {
    expect(s.getMaxTraceNum()).toBe(5);
    s.setMaxTraceNum(8);
    expect(s.getMaxTraceNum()).toBe(8);
  });

  it('poppingLeverage falls back to 1.0 and round-trips', () => {
    expect(s.getPoppingLeverage()).toBe(1.0);
    s.setPoppingLeverage(2.5);
    expect(s.getPoppingLeverage()).toBe(2.5);
  });

  it('animationDuration falls back to 200 and round-trips', () => {
    expect(s.getAnimationDuration()).toBe(200);
    s.setAnimationDuration(100);
    expect(s.getAnimationDuration()).toBe(100);
  });

  it('explorationTarget returns default on missing/invalid/partial json', () => {
    expect(s.getExplorationTarget().category).toBe(
      ExplorationCategory.PuyotsukaiCount
    );
    storage.setItem('explorationTarget', '{not json');
    expect(s.getExplorationTarget().optimal_solution_count).toBe(5);
    storage.setItem('explorationTarget', '{}');
    expect(s.getExplorationTarget().optimal_solution_count).toBe(5);
  });

  it('explorationTarget round-trips a valid target', () => {
    const target = {
      category: ExplorationCategory.PuyotsukaiCount,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 3
    } as ExplorationTarget;
    s.setExplorationTarget(target);
    expect(s.getExplorationTarget()).toEqual(target);
  });

  it('solutionMethod falls back to parallel wasm and round-trips', () => {
    expect(s.getSolutionMethod()).toBe(SolutionMethod.solveAllInParallelByWasm);
    s.setSolutionMethod(SolutionMethod.solveAllInSerial);
    expect(s.getSolutionMethod()).toBe(SolutionMethod.solveAllInSerial);
  });

  it('solutionMethod keeps the Rust backend on localhost', () => {
    s.setSolutionMethod(SolutionMethod.solveAllByRustBackend);
    expect(s.getSolutionMethod()).toBe(SolutionMethod.solveAllByRustBackend);
  });

  it('solutionMethod falls back from the Rust backend to parallel wasm off localhost', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'example.com' });
    s.setSolutionMethod(SolutionMethod.solveAllByRustBackend);
    expect(s.getSolutionMethod()).toBe(SolutionMethod.solveAllInParallelByWasm);
    vi.unstubAllGlobals();
  });

  it('lastScreenshotBoard returns undefined when absent/empty and round-trips', () => {
    expect(s.getLastScreenshotBoard()).toBeUndefined();
    s.setLastScreenshotBoard(undefined);
    expect(s.getLastScreenshotBoard()).toBeUndefined();
    const board = { field: [[1]], nextPuyos: [1] } as unknown as Board;
    s.setLastScreenshotBoard(board);
    expect(s.getLastScreenshotBoard()).toEqual(board);
  });

  it('boostAreaKeyList returns [] when absent and round-trips', () => {
    expect(s.getBoostAreaKeyList()).toEqual([]);
    s.setBoostAreaKeyList(['a', 'b']);
    expect(s.getBoostAreaKeyList()).toEqual(['a', 'b']);
  });

  it('paintSearchSettings returns the defaults when absent and round-trips', () => {
    expect(s.getPaintSearchSettings()).toEqual(defaultPaintSearchSettings);

    const settings = {
      color: PuyoAttr.Green,
      maxPaintNum: 10,
      maxTraceNum: 6,
      precision: PaintPrecision.High,
      showExpectedValue: true
    } as const;
    s.setPaintSearchSettings(settings);
    expect(s.getPaintSearchSettings()).toEqual(settings);
  });

  it('plusAssignSettings returns the defaults when absent and round-trips', () => {
    expect(s.getPlusAssignSettings()).toEqual(defaultPlusAssignSettings);

    const settings = {
      ...defaultPlusAssignSettings,
      enabled: true,
      num: 10
    };
    s.setPlusAssignSettings(settings);
    expect(s.getPlusAssignSettings()).toEqual(settings);
  });

  it('plusAssignSettings falls back per field when the stored value is broken', () => {
    localStorage.setItem('plusAssignSettings', '{');
    expect(s.getPlusAssignSettings()).toEqual(defaultPlusAssignSettings);

    localStorage.setItem(
      'plusAssignSettings',
      JSON.stringify({ enabled: 'yes', num: 999 })
    );
    expect(s.getPlusAssignSettings()).toEqual({
      ...defaultPlusAssignSettings,
      enabled: true
    });
  });

  it('paintSearchSettings falls back per field when the stored value is broken', () => {
    // 壊れた JSON
    localStorage.setItem('paintSearchSettings', '{');
    expect(s.getPaintSearchSettings()).toEqual(defaultPaintSearchSettings);

    // 値が範囲外・型違い。おかしい項目だけ既定へ倒し、正しい項目は活かす
    localStorage.setItem(
      'paintSearchSettings',
      JSON.stringify({
        color: PuyoAttr.Heart,
        maxPaintNum: 999,
        maxTraceNum: 99,
        precision: 'nonsense',
        showExpectedValue: 'yes'
      })
    );
    expect(s.getPaintSearchSettings()).toEqual({
      color: defaultPaintSearchSettings.color,
      maxPaintNum: defaultPaintSearchSettings.maxPaintNum,
      maxTraceNum: defaultPaintSearchSettings.maxTraceNum,
      precision: defaultPaintSearchSettings.precision,
      showExpectedValue: true
    });
  });

  it('boardEditMode returns ClearEnhance default and round-trips/removes', () => {
    expect(s.getBoardEditMode()).toEqual({
      howToEdit: HowToEditBoard.ClearEnhance
    });
    s.setBoardEditMode({ howToEdit: HowToEditBoard.ToRed });
    expect(s.getBoardEditMode()).toEqual({
      howToEdit: HowToEditBoard.ToRed
    });
    s.setBoardEditMode(undefined);
    expect(s.getBoardEditMode()).toEqual({
      howToEdit: HowToEditBoard.ClearEnhance
    });
  });
});
