import type React from 'react';
import {
  OptimizationCategory,
  getOptimizationCategoryDescription
} from '../logics/OptimizationTarget';
import {
  type ColoredPuyoAttribute,
  getPuyoAttributeName
} from '../logics/PuyoAttribute';
import { Simulator } from '../logics/Simulator';
import type { ExplorationResult } from '../logics/solution';

type SolutionResultViewProps = {
  /** 探索中かどうか */
  solving: boolean;

  /** 解 */
  result: ExplorationResult | undefined;
};

/** 探索結果View */
const SolutionResultView: React.FC<SolutionResultViewProps> = (props) => {
  const { solving, result } = props;

  return (
    <>
      <div>{solving ? '探索中…' : '探索結果'}</div>
      <hr />
      {result ? (
        <div>
          <div>探索法: {result?.solutionMethod}</div>
          <div>
            探索対象:{' '}
            {getOptimizationCategoryDescription(
              result?.optimizationTarget.category
            )}
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
            <OptimalValue result={result} />
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

const OptimalValue: React.FC<{ result: ExplorationResult | undefined }> = (
  props
) => {
  const { result } = props;

  switch (result?.optimizationTarget.category) {
    case OptimizationCategory.Damage:
      return (
        <div>対象のダメージ量: {result?.optimalSolution?.value.toFixed(2)}</div>
      );
    case OptimizationCategory.PuyoCount:
      return <div>スキル溜めぷよ数: {result?.optimalSolution?.value}</div>;
    case OptimizationCategory.PuyotsukaiCount:
      return <div>ぷよ使いカウント: {result?.optimalSolution?.value}</div>;
    default:
      return <div>最適値: </div>;
  }
};

export default SolutionResultView;
