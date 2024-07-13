import { Box, HStack, Select, Text } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import {
  type TraceMode,
  getTraceModeDescription,
  possibleTraceModeList
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
        <Text fontSize="sm">なぞり消しモード:</Text>
      </Box>
      <Select
        aria-label="なぞり消しモードの選択"
        w="10em"
        size="sm"
        value={traceMode}
        onChange={onChanged}
      >
        {possibleTraceModeList.map((traceMode) => {
          return (
            <option value={traceMode} key={traceMode}>
              {getTraceModeDescription(traceMode)}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

export default TraceModeSelector;
