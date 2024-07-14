import { Progress } from '@chakra-ui/react';
import type React from 'react';
import {
  ExplorationCategory,
  getExplorationCategoryDescription
} from '../logics/ExplorationTarget';
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
      <Progress
        size="xs"
        visibility={solving ? 'visible' : 'hidden'}
        isIndeterminate={solving}
      />
      <hr />
      {result ? (
        <div>
          <div>
            探索対象:{' '}
            {getExplorationCategoryDescription(
              result?.explorationTarget.category
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

  switch (result?.explorationTarget.category) {
    case ExplorationCategory.Damage:
      return (
        <div>対象のダメージ量: {result?.optimalSolution?.value.toFixed(2)}</div>
      );
    case ExplorationCategory.SkillPuyoCount:
      return <div>スキル溜めぷよ数: {result?.optimalSolution?.value}</div>;
    case ExplorationCategory.PuyotsukaiCount:
      return <div>ぷよ使いカウント: {result?.optimalSolution?.value}</div>;
    default:
      return <div>最適値: </div>;
  }
};

export default SolutionResultView;
