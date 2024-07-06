import type React from 'react';
import { getOptimizationTargetDescription } from '../logics/OptimizationTarget';
import { Simulator } from '../logics/Simulator';
import {
  type ColoredPuyoAttribute,
  getPuyoAttributeName
} from '../logics/puyo';
import type { SolvedResult } from '../logics/solution';

type IProps = {
  /** 探索中かどうか */
  solving: boolean;

  /** 解 */
  result: SolvedResult | undefined;
};

/** 探索結果View */
const SolutionResultView: React.FC<IProps> = (props) => {
  const { solving, result } = props;

  return (
    <>
      <div>{solving ? '探索中…' : '探索結果'}</div>
      <hr />
      {result ? (
        <div>
          <div>探索法: {result?.solutionMethod}</div>
          <div>
            最適化対象:{' '}
            {getOptimizationTargetDescription(result?.optimizationTarget)}
          </div>
          <div>探索時間: {result?.elapsedTime} ms</div>
          <div>候補数: {result?.candidatesNum}</div>
          <div>
            最適なぞり:{' '}
            {result?.optimalSolution?.traceCoords
              .map((c) => c.toCellAddr())
              .join(',')}
          </div>
          <div>
            <div>
              ぷよ使いカウント: {result?.optimalSolution?.puyoTsukaiCount}
            </div>
            {Simulator.colorAttrs.map((attr) => {
              const description = getPuyoAttributeName(attr);
              return (
                <div key={attr}>
                  {description}:{' '}
                  {result?.optimalSolution?.totalDamages[
                    attr as ColoredPuyoAttribute
                  ]?.toFixed(2)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        ''
      )}
    </>
  );
};

export default SolutionResultView;
