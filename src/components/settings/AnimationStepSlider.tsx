import { ArrowBackIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import {
  HStack,
  Icon,
  IconButton,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Tooltip
} from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import type { AnimationStep } from '../../logics/AnimationStep';
import {
  chainAnimationStep,
  chainAnimationStepBack,
  chainAnimationStepForward
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** アニメーションステップのリスト */
  animationSteps: AnimationStep[];
  /** 活性なアニメーションステップのインデックス */
  index: number;
}

/** ワンステップのアニメーション時間間隔入力 */
const AnimationStepSlider: React.FC<IProps> = (props) => {
  const { animationSteps, index } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onBack = () => dispatch(chainAnimationStepBack());
  const onChanged = (value: number) => dispatch(chainAnimationStep(value));
  const onForward = () => dispatch(chainAnimationStepForward());
  const min = 0;
  const max = animationSteps.length - 1;
  const visibility = animationSteps.length === 0 ? 'hidden' : 'visible';

  return (
    <HStack visibility={visibility}>
      <Tooltip label="コマ戻り">
        <IconButton
          variant="outline"
          aria-label="コマ戻り"
          icon={<Icon as={ArrowBackIcon} />}
          isDisabled={index === 0}
          onClick={onBack}
        />
      </Tooltip>
      <Slider value={index} min={min} max={max} step={1} onChange={onChanged}>
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider>
      <Tooltip label="コマ送り">
        <IconButton
          variant="outline"
          aria-label="コマ送り"
          icon={<Icon as={ArrowForwardIcon} />}
          isDisabled={index === max}
          onClick={onForward}
        />
      </Tooltip>
    </HStack>
  );
};

export default AnimationStepSlider;
