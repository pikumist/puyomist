import { Box, HStack, Select, Text } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import {
  type TraceMode,
  traceModeDescriptionMap
} from '../../logics/TraceMode';
import { traceModeChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  traceMode: TraceMode;
}

/** なぞり消しモードの選択 */
const TraceModeSelector: React.FC<IProps> = (props) => {
  const { traceMode } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(traceModeChanged(Number.parseInt(e.target.value) as TraceMode));

  return (
    <HStack>
      <Box>
        <Text>なぞり</Text>
      </Box>
      <Select
        aria-label="なぞりモードの選択"
        w="10em"
        value={traceMode}
        onChange={onChanged}
      >
        {[...traceModeDescriptionMap].map(([traceMode, description]) => {
          return (
            <option value={traceMode} key={traceMode}>
              {description}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

export default TraceModeSelector;
