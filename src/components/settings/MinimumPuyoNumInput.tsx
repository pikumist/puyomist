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
import { TraceMode } from '../../logics/TraceMode';
import { minimumPuyoNumForPoppingChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  traceMode: TraceMode;
  /** ぷよが消えるのに必要な個数 */
  num: number;
}

/** ぷよが消えるのに必要な個数入力 */
const MinimumPuyoNumInput: React.FC<IProps> = (props) => {
  const { traceMode, num } = props;
  const isDisabled = traceMode !== TraceMode.Normal;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(minimumPuyoNumForPoppingChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>ぷよが消えるのに必要な個数:</Text>
      </Box>
      <NumberInput
        width="4em"
        value={num}
        step={1}
        min={3}
        max={4}
        isDisabled={isDisabled}
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

export default MinimumPuyoNumInput;
