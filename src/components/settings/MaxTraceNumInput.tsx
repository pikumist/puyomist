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
import { maxTraceNumChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 最大なぞり消し数 */
  maxTraceNum: number;
}

/** 最大なぞり消し数の入力 */
const MaxTraceNumInput: React.FC<IProps> = (props) => {
  const { maxTraceNum } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(maxTraceNumChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>最大なぞり消し数:</Text>
      </Box>
      <NumberInput
        width="4.5em"
        value={maxTraceNum}
        step={1}
        min={1}
        max={15}
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

export default MaxTraceNumInput;
