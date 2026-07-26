import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import { pastelClassForAttr } from '@/components/controls/puyoColorClass';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import {
  type PaintPlan,
  type PaintPrecision,
  createMockPaintSearchResult,
  paintPrecisionDescriptionMap,
  rustBackendPaintPrecisionList,
  wasmPaintPrecisionList
} from '@/logics/paint-search';
import { SolutionMethod } from '@/logics/solution';
import {
  paintPlanApplied,
  paintPlanHovered,
  paintSearchSettingsChanged,
  paintSearchStarted,
  paintSearched,
  usePuyoAppState
} from '@/store/puyoAppStore';

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
  const {
    simulationData,
    solutionMethod,
    paintSearchSettings,
    paintSearching,
    paintSearchResult
  } = usePuyoAppState();
  const { color, maxPaintNum, precision, showExpectedValue } =
    paintSearchSettings;

  // 超高精度は Rustバックエンドのときだけ選べる。WASM は単スレッドなので出さない。
  const precisionList =
    solutionMethod === SolutionMethod.solveAllByRustBackend
      ? rustBackendPaintPrecisionList
      : wasmPaintPrecisionList;
  const precisionItems = precisionList.map(
    (p) => [p, paintPrecisionDescriptionMap.get(p)!] as const
  );

  const onSearchClick = () => {
    paintSearchStarted();
    // TODO: モックの見た目確認用。WASM / Rustバックエンドが入ったら差し替える。
    const result = createMockPaintSearchResult(
      simulationData,
      paintSearchSettings
    );
    setTimeout(() => paintSearched(result), 300);
  };

  const onApplyClick = (plan: PaintPlan) => {
    paintPlanApplied(plan.coords);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        showOverlay={false}
        className="top-auto bottom-4 max-h-[70svh] translate-y-0 overflow-y-auto sm:max-w-md lg:right-4 lg:left-auto lg:translate-x-0"
      >
        <DialogHeader>
          <DialogTitle>ぷよ塗り探索</DialogTitle>
          <DialogDescription>
            なぞる前に盤面を1色に塗り替えて、連鎖しやすい形を探す。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <SettingRow label="塗り色">
            <RadioGroup
              className="flex gap-2"
              value={color}
              onValueChange={(v) =>
                paintSearchSettingsChanged({ color: v as ColoredPuyoAttr })
              }
            >
              {coloredPuyoAttrList.map((attr) => (
                <Label
                  key={attr}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${pastelClassForAttr(attr)}`}
                >
                  <RadioGroupItem value={attr} />
                  <span className="text-xs">{getPuyoAttrName(attr)}</span>
                </Label>
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
          <Button onClick={onSearchClick} disabled={paintSearching}>
            {paintSearching ? '塗り探索中…' : '塗り探索'}
          </Button>
          <Progress
            className="mt-2"
            value={paintSearching ? null : 0}
            style={{ visibility: paintSearching ? 'visible' : 'hidden' }}
          />
        </div>

        {paintSearchResult && (
          <PaintPlanList
            plans={paintSearchResult.plans}
            showExpectedValue={showExpectedValue}
            onApply={onApplyClick}
          />
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
};

interface PaintPlanListProps {
  plans: PaintPlan[];
  showExpectedValue: boolean;
  onApply: (plan: PaintPlan) => void;
}

/** 塗り案のリスト。行にホバーすると盤面に塗るマスがハイライトされる。 */
const PaintPlanList: React.FC<PaintPlanListProps> = (props) => {
  const { plans, showExpectedValue, onApply } = props;

  return (
    <ul className="space-y-1" aria-label="塗り案">
      {plans.map((plan, i) => (
        <li key={String(i)}>
          <div
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
            onMouseEnter={() => paintPlanHovered(plan.coords)}
            onMouseLeave={() => paintPlanHovered(undefined)}
            onFocus={() => paintPlanHovered(plan.coords)}
            onBlur={() => paintPlanHovered(undefined)}
          >
            <span className="w-6 text-right text-xs text-muted-foreground">
              {i + 1}
            </span>
            <span className="w-16 text-xs text-muted-foreground">
              {plan.coords.length === 0
                ? '塗らない'
                : `${plan.coords.length}マス`}
            </span>
            <span className="font-medium tabular-nums">{plan.value}</span>
            {showExpectedValue && (
              <span className="text-xs text-muted-foreground tabular-nums">
                期待値 {plan.expectedValue}
              </span>
            )}
            <Button
              className="ml-auto"
              size="xs"
              variant="outline"
              disabled={plan.coords.length === 0}
              onClick={() => onApply(plan)}
            >
              適用
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default PaintSearchDialog;
