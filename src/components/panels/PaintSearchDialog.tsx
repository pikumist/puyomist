import { CheckIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  RadioGroup,
  RadioGroupChip,
  RadioGroupSegment,
  RadioGroupSegments
} from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ExplorationCategory } from '@/logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  PuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import type { PuyoCoord } from '@/logics/PuyoCoord';
import {
  PaintGoal,
  type PaintPlan,
  type PaintPrecision,
  paintGoalDescriptionMap,
  paintGoalList,
  paintGoalNameMap,
  paintMaxTraceNumLimit,
  paintPrecisionDescriptionMap,
  paintPrecisionListFor
} from '@/logics/paint-search';
import {
  paintPlanApplyClicked,
  paintSearchButtonClicked
} from '@/store/actions';
import {
  paintPlanHovered,
  paintSearchCancelButtonClicked,
  paintSearchSettingsChanged,
  usePuyoAppState
} from '@/store/puyoAppStore';
import { selectPaintSearchResult } from '@/store/selectors';

/**
 * 塗り色チップの配色。未選択はごく薄い地色、選択中はその色でべた塗りする。
 * Tailwind のスキャナに拾わせるため、クラスはリテラルで列挙する。
 */
const paintChipClass: Record<ColoredPuyoAttr, string> = {
  [PuyoAttr.Red]:
    'bg-red-500/12 hover:bg-red-500/25 data-checked:bg-red-400 data-checked:text-red-950',
  [PuyoAttr.Blue]:
    'bg-blue-500/12 hover:bg-blue-500/25 data-checked:bg-blue-400 data-checked:text-blue-950',
  [PuyoAttr.Green]:
    'bg-green-500/12 hover:bg-green-500/25 data-checked:bg-green-400 data-checked:text-green-950',
  [PuyoAttr.Yellow]:
    'bg-yellow-500/12 hover:bg-yellow-500/25 data-checked:bg-yellow-300 data-checked:text-yellow-950',
  [PuyoAttr.Purple]:
    'bg-purple-500/12 hover:bg-purple-500/25 data-checked:bg-purple-400 data-checked:text-purple-950'
};

/** 未選択チップに置く色の点 */
const paintDotClass: Record<ColoredPuyoAttr, string> = {
  [PuyoAttr.Red]: 'bg-red-500',
  [PuyoAttr.Blue]: 'bg-blue-500',
  [PuyoAttr.Green]: 'bg-green-500',
  [PuyoAttr.Yellow]: 'bg-yellow-400',
  [PuyoAttr.Purple]: 'bg-purple-500'
};

interface PaintSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ぷよ塗り探索のモーダル。
 *
 * 盤面へのハイライトを見せたいので `modal={false}` + オーバーレイ無しで開き、
 * 盤面を覆わない位置 (広い画面では右端) に寄せる。
 */
const PaintSearchDialog: React.FC<PaintSearchDialogProps> = (props) => {
  const { open, onOpenChange } = props;
  const state = usePuyoAppState();
  const {
    solutionMethod,
    explorationTarget,
    paintSearchSettings,
    paintSearching,
    paintSearchProgressPercent
  } = state;
  // 盤面や設定が変わったあとの古い結果は選択の段階で捨てられる
  const paintSearchResult = selectPaintSearchResult(state);
  const {
    goal,
    color,
    maxPaintNum,
    maxTraceNum,
    precision,
    showExpectedValue
  } = paintSearchSettings;
  const igniting = goal === PaintGoal.Ignite;

  // 仕込みの超高精度は Rustバックエンドのときだけ選べる (WASM は単スレッドで重すぎる)。
  // 発火は wasm の超高精度でも約5.6秒なので、どの探索法でも全部選べる。
  const precisionItems = paintPrecisionListFor(solutionMethod, goal).map(
    (p) => [p, paintPrecisionDescriptionMap.get(p)!] as const
  );

  // 行にホバーしたまま Escape で閉じると mouseleave が来ないので、
  // 閉じるときは必ずハイライトを消す。
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      paintPlanHovered(undefined);
    }
    onOpenChange(next);
  };

  const onApplyClick = (plan: PaintPlan) => {
    // 発火の案は塗ったあと連鎖まで走る。盤面を見せたいのでダイアログは閉じる。
    paintPlanApplyClicked(plan.coords);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        showOverlay={false}
        className="top-auto bottom-4 max-h-[70svh] translate-y-0 overflow-y-auto sm:max-w-md lg:right-4 lg:left-auto lg:translate-x-0"
      >
        <DialogHeader>
          <DialogTitle>ぷよ塗り探索</DialogTitle>
          <DialogDescription>
            {paintGoalDescriptionMap.get(goal)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* 狙いが変わると探索そのものが別物になる (ハード制約が正反対) ので、
              いちばん上に置いて先に決めてもらう。 */}
          <SettingRow label="狙い">
            <RadioGroupSegments
              aria-label="狙い"
              value={goal}
              onValueChange={(v) =>
                paintSearchSettingsChanged({ goal: v as PaintGoal })
              }
            >
              {paintGoalList.map((g) => (
                <RadioGroupSegment key={g} value={g}>
                  {paintGoalNameMap.get(g)}
                </RadioGroupSegment>
              ))}
            </RadioGroupSegments>
          </SettingRow>

          <SettingRow label="塗り色">
            <RadioGroup
              aria-label="塗り色"
              className="flex flex-wrap gap-1.5"
              value={color}
              onValueChange={(v) =>
                paintSearchSettingsChanged({ color: v as ColoredPuyoAttr })
              }
            >
              {coloredPuyoAttrList.map((attr) => (
                <RadioGroupChip
                  key={attr}
                  value={attr}
                  className={paintChipClass[attr]}
                >
                  {/* 未選択は色の点、選択中はチェック。同じ場所で入れ替える */}
                  <span className="flex size-3 items-center justify-center">
                    <span
                      className={cn(
                        'size-2.5 rounded-full group-data-checked/chip:hidden',
                        paintDotClass[attr]
                      )}
                    />
                    <CheckIcon className="hidden size-3 group-data-checked/chip:block" />
                  </span>
                  {getPuyoAttrName(attr)}
                </RadioGroupChip>
              ))}
            </RadioGroup>
          </SettingRow>

          <SettingRow label="塗り上限">
            <NumberStepper
              ariaLabel="塗り上限"
              value={maxPaintNum}
              min={1}
              max={16}
              onChange={(v) => paintSearchSettingsChanged({ maxPaintNum: v })}
            />
          </SettingRow>

          {/* 盤面設定の最大なぞり数とは別物。上限を低くしてあるのは、検証件数ぶんの
              なぞり探索になり、なぞり数のコストがその件数倍で効くため。
              発火は塗った時点で連鎖が終わるので、なぞり数そのものが無い。
              **行は消さずに無効化する。** 狙いを切り替えるたびに行が増減すると、
              見ていた行の位置がずれて読み直しになる。 */}
          <SettingRow label="最大なぞり数" disabled={igniting}>
            <NumberStepper
              ariaLabel="最大なぞり数"
              value={maxTraceNum}
              min={1}
              max={paintMaxTraceNumLimit}
              disabled={igniting}
              onChange={(v) => paintSearchSettingsChanged({ maxTraceNum: v })}
            />
          </SettingRow>

          <SettingRow label="探索精度">
            <EnumSelect<PaintPrecision>
              ariaLabel="探索精度の選択"
              value={precision}
              items={precisionItems}
              onValueChange={(v) =>
                paintSearchSettingsChanged({ precision: v })
              }
            />
          </SettingRow>

          <SettingRow label="期待値も表示">
            <Switch
              aria-label="期待値も表示"
              checked={showExpectedValue}
              onCheckedChange={(checked) =>
                paintSearchSettingsChanged({ showExpectedValue: checked })
              }
            />
          </SettingRow>
        </div>

        <div>
          {/* 主ボタンを右端に置いて親指の届く位置にする */}
          <div className="flex justify-end gap-2">
            {paintSearching && (
              <Button
                variant="outline"
                onClick={() => paintSearchCancelButtonClicked()}
              >
                中断
              </Button>
            )}
            <Button
              onClick={() => paintSearchButtonClicked()}
              disabled={paintSearching}
            >
              {paintSearching ? '塗り探索中…' : '塗り探索'}
            </Button>
          </div>
          {/* 仕込みは標準精度でも十数秒かかるので進捗を見せる。発火は標準0.5秒・
              超高精度でも5.6秒で途中経過も出せないので、場所だけ取って中身は出さない。
              (消すと狙いを切り替えたときに高さが変わってしまう) */}
          <Progress
            className="mt-2"
            value={paintSearchProgressPercent || null}
            style={{
              visibility: paintSearching && !igniting ? 'visible' : 'hidden'
            }}
          />
        </div>

        {paintSearchResult && (
          <PaintPlanList
            plans={paintSearchResult.plans}
            category={explorationTarget.category}
            showExpectedValue={showExpectedValue}
            onApply={onApplyClick}
          />
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
};

/**
 * 探索対象の値の書式。
 *
 * ダメージは**小数点第3位まで** (第4位を四捨五入)。素の数値をそのまま出すと
 * `240.29999999999998` のような浮動小数の見た目が漏れる。
 * スキル溜めとぷよ使いカウントは個数なので整数で出す。
 *
 * なぞり消し探索の表示 (`OptimalSolutionSelector` など) はダメージを第2位までに
 * しているが、塗り探索は案どうしの差が小さいことがあるので1桁多く出す。
 */
const formatPlanValue = (
  category: ExplorationCategory,
  value: number
): string => value.toFixed(category === ExplorationCategory.Damage ? 3 : 0);

interface PaintPlanListProps {
  plans: PaintPlan[];
  category: ExplorationCategory;
  showExpectedValue: boolean;
  onApply: (plan: PaintPlan) => void;
}

/**
 * 塗り案のリスト。
 *
 * 塗るマスは行を**選ぶ**と盤面にハイライトされる。ホバーでも一時的に映すが、
 * タッチ端末にホバーは無いので、選択を主・ホバーを副の関係にしてある
 * (ホバーが外れたら選択中の案へ戻る)。
 */
const PaintPlanList: React.FC<PaintPlanListProps> = (props) => {
  const { plans, category, showExpectedValue, onApply } = props;
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const preview = (coords: PuyoCoord[] | undefined) => {
    paintPlanHovered(coords ?? plans[selectedIndex]?.coords);
  };

  const toggleSelection = (index: number) => {
    const next = selectedIndex === index ? -1 : index;
    setSelectedIndex(next);
    paintPlanHovered(next === -1 ? undefined : plans[next].coords);
  };

  return (
    <ul className="space-y-1" aria-label="塗り案">
      {plans.map((plan, i) => (
        <li key={String(i)} className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={selectedIndex === i}
            className={cn(
              'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              selectedIndex === i && 'bg-muted ring-1 ring-foreground/20'
            )}
            onClick={() => toggleSelection(i)}
            onMouseEnter={() => preview(plan.coords)}
            onMouseLeave={() => preview(undefined)}
            onFocus={() => preview(plan.coords)}
            onBlur={() => preview(undefined)}
          >
            <span className="w-6 text-right text-xs text-muted-foreground">
              {i + 1}
            </span>
            <span className="w-16 text-xs text-muted-foreground">
              {plan.coords.length === 0
                ? '塗らない'
                : `${plan.coords.length}マス`}
            </span>
            <span className="font-medium tabular-nums">
              {formatPlanValue(category, plan.value)}
            </span>
            {showExpectedValue && plan.expectedValue !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                期待値 {formatPlanValue(category, plan.expectedValue)}
              </span>
            )}
          </button>
          <Button
            size="xs"
            variant="outline"
            disabled={plan.coords.length === 0}
            onClick={() => onApply(plan)}
          >
            適用
          </Button>
        </li>
      ))}
    </ul>
  );
};

export default PaintSearchDialog;
