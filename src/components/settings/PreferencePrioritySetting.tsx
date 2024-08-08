import { AddIcon, ChevronDownIcon } from '@chakra-ui/icons';
import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  type PreferenceKind,
  getDerivativePreferenceList,
  isValuePreference,
  preferenceKindDescriptionMap
} from '../../logics/ExplorationTarget';
import {
  explorationPreferenceAdded,
  explorationPreferencePrioritiesChanged,
  explorationPreferenceReplaced
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import SortableList from '../sortable-list/SortableList';

/** プリファレンス優先度の設定 */
const PreferencePrioritySetting: React.FC<{
  preferencePriorities: PreferenceKind[];
}> = (props) => {
  const { preferencePriorities } = props;
  const dispatch = useDispatch<AppDispatch>();

  const items = useMemo(() => {
    return preferencePriorities.map((pref, i) => ({
      id: pref,
      index: i + 1,
      description: preferenceKindDescriptionMap.get(pref)
    }));
  }, [preferencePriorities]);

  const addablePrefereces = useMemo(() => {
    const forbiddenSet = new Set(preferencePriorities.map((pref) => pref % 10));
    return [...preferenceKindDescriptionMap.keys()].filter((pref) => {
      return pref < 10 && !forbiddenSet.has(pref % 10);
    });
  }, [preferencePriorities]);

  const onListChanged = (
    items: {
      id: PreferenceKind;
      index: number;
      description: string | undefined;
    }[]
  ) => {
    dispatch(explorationPreferencePrioritiesChanged(items.map(({ id }) => id)));
  };

  const onAddMenuItemClicked: React.MouseEventHandler<HTMLButtonElement> = (
    e
  ) => {
    const pref: PreferenceKind = Number.parseInt(
      (e.target as HTMLButtonElement).dataset.pref!,
      10
    );
    dispatch(explorationPreferenceAdded(pref));
  };

  const onChangeMenuItemClicked: React.MouseEventHandler<HTMLButtonElement> = (
    e
  ) => {
    const from: PreferenceKind = Number.parseInt(
      (e.target as HTMLButtonElement).dataset.from!,
      10
    );
    const to: PreferenceKind = Number.parseInt(
      (e.target as HTMLButtonElement).dataset.to!,
      10
    );
    dispatch(explorationPreferenceReplaced({ from, to }));
  };

  return (
    <Stack>
      <HStack>
        <Text>優先度</Text>
        {addablePrefereces.length > 0 ? (
          <Menu size="sm">
            <MenuButton padding={0} as="div">
              <IconButton
                size="sm"
                variant="outline"
                aria-label="優先度を追加"
                icon={<AddIcon />}
              />
            </MenuButton>
            <MenuList>
              {addablePrefereces.map((pref) => (
                <MenuItem
                  key={pref}
                  fontSize="sm"
                  data-pref={pref}
                  onClick={onAddMenuItemClicked}
                >
                  {preferenceKindDescriptionMap.get(pref)}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        ) : null}
      </HStack>
      <SortableList
        items={items}
        onChange={onListChanged}
        renderItem={(item) => {
          const background = isValuePreference(item.id)
            ? 'green.800'
            : 'gray.700';
          const devivatives = getDerivativePreferenceList(item.id);
          return (
            <SortableList.Item id={item.id}>
              <HStack background={background}>
                <Text ml="2" fontSize="sm">
                  {item.index}.
                </Text>
                <Menu size="sm">
                  <MenuButton padding={0}>
                    <HStack>
                      <Text fontSize="sm">{item.description}</Text>
                      <ChevronDownIcon />
                    </HStack>
                  </MenuButton>
                  <MenuList>
                    {devivatives.map((pref) => (
                      <MenuItem
                        key={pref}
                        fontSize="sm"
                        data-from={item.id}
                        data-to={pref}
                        onClick={onChangeMenuItemClicked}
                      >
                        {preferenceKindDescriptionMap.get(pref)}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
                <SortableList.DragHandle ml="auto" />
              </HStack>
            </SortableList.Item>
          );
        }}
      />
    </Stack>
  );
};

export default PreferencePrioritySetting;
