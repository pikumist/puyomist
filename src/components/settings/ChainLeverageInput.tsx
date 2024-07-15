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
import { chainLeverageChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 連鎖倍率 */
  leverage: number;
}

/** 連鎖倍率の入力 */
const ChainLeverageInput: React.FC<IProps> = (props) => {
  const { leverage } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(chainLeverageChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>連鎖倍率:</Text>
      </Box>
      <NumberInput
        width="5.5em"
        value={leverage.toFixed(1)}
        step={0.1}
        min={1.0}
        max={19.9}
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

export default ChainLeverageInput;
