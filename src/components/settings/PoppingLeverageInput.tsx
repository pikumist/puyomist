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
import { poppingLeverageChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 同時消し倍率 */
  leverage: number;
}

/** 同時消し倍率の入力 */
const PoppingLeverageInput: React.FC<IProps> = (props) => {
  const { leverage } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(poppingLeverageChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>同時消し倍率:</Text>
      </Box>
      <NumberInput
        width="4.5em"
        value={leverage.toFixed(1)}
        step={0.1}
        min={1.0}
        max={9.9}
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

export default PoppingLeverageInput;
