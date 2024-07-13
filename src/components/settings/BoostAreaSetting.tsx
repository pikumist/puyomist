import { Box, Checkbox, CheckboxGroup, Stack, Text } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import { getBoostArea, possibleBoostAreaKeyList } from '../../logics/BoostArea';
import { boostAreaKeyListChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** ブーストエリアキーリスト */
  boostAreaKeyList: string[];
}

/** ブーストエリア設定 */
const BoostAreaSetting: React.FC<IProps> = (props) => {
  const { boostAreaKeyList } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onKeyListChanged = (keyList: string[]) =>
    dispatch(boostAreaKeyListChanged(keyList));

  return (
    <Stack my={2} spacing={0}>
      <Box>
        <Text fontSize="sm">ブーストエリア:</Text>
      </Box>
      <CheckboxGroup
        size="sm"
        value={boostAreaKeyList}
        onChange={onKeyListChanged}
      >
        <Stack spacing={[1, 5]} direction={['column', 'row']}>
          {possibleBoostAreaKeyList.map((key) => (
            <Checkbox key={key} value={key}>
              {getBoostArea(key)!.name}
            </Checkbox>
          ))}
        </Stack>
      </CheckboxGroup>
    </Stack>
  );
};

export default BoostAreaSetting;
