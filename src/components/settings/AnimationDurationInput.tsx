import {
  Box,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text
} from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import { animationDurationChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** ワンステップのアニメーションの時間間隔(ms) */
  duration: number;
}

/** ワンステップのアニメーション時間間隔入力 */
const AnimationDurationInput: React.FC<IProps> = (props) => {
  const { duration } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(animationDurationChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>ステップ時間間隔(ms):</Text>
      </Box>
      <NumberInput
        width="6em"
        value={duration}
        step={100}
        min={0}
        max={3000}
        onChange={onChanged}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </HStack>
  );
};

export default AnimationDurationInput;
