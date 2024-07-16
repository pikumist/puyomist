import { HStack, Select, Text } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import {
  type SolutionMethod,
  solutionMethodDescriptionMap
} from '../../logics/solution';
import { solutionMethodItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 探索法 */
  method: SolutionMethod;
}

/** 探索法の選択 */
const SolutionMethodSelector: React.FC<IProps> = (props) => {
  const { method } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(solutionMethodItemSelected(e.target.value as SolutionMethod));

  return (
    <HStack>
      <Text>探索法:</Text>
      <Select
        aria-label="探索法の選択"
        w="14em"
        value={method}
        onChange={onChanged}
      >
        {[...solutionMethodDescriptionMap].map(([method, description]) => {
          return (
            <option value={method} key={method}>
              {description}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

export default SolutionMethodSelector;
