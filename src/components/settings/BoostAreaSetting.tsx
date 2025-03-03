import { Checkbox, CheckboxGroup, Grid, Stack, Text } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import { boostAreaKeyMap } from '../../logics/BoostArea';
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
    <Stack my={2} spacing={1}>
      <Text>ブーストエリア</Text>
      <CheckboxGroup value={boostAreaKeyList} onChange={onKeyListChanged}>
        <Grid templateColumns="repeat(5, 1fr)">
          {[...boostAreaKeyMap].map(([key, area]) => (
            <Checkbox key={key} value={key} size="sm">
              {area.name}
            </Checkbox>
          ))}
        </Grid>
      </CheckboxGroup>
    </Stack>
  );
};

export default BoostAreaSetting;
