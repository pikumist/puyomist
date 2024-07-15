import { EditIcon } from '@chakra-ui/icons';
import {
  Box,
  type BoxProps,
  Button,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  useBoolean
} from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import {
  type BoardEditMode,
  HowToEditBoard,
  getHowToEditBoardDescription,
  possibleHowToEditBoardList
} from '../../logics/BoardEditMode';
import { type PuyoType, puyoTypeMap } from '../../logics/PuyoType';
import {
  boardEditCustomTypeChanged,
  boardEditingEnded,
  boardEditingStarted,
  howToEditBoardChanged
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import PuyoIcon from '../PuyoIcon';

interface IProps extends BoxProps {
  /** 盤面が編集中かどうか */
  isBoardEditing: boolean;
  /** 盤面編集モード */
  boardEditMode: BoardEditMode | undefined;
}

const emptyKey = 'empty';

/** 盤面編集ポップオーバー */
const BoardEditPopover: React.FC<IProps> = (props) => {
  const { isBoardEditing, boardEditMode, ...rest } = props;
  const [isEditing, setIsEditing] = useBoolean();
  const dispatch = useDispatch<AppDispatch>();

  const onEditStartButtonClicked = () => {
    dispatch(boardEditingStarted());
    setIsEditing.off();
  };

  const onEditEndButtonClicked = () => {
    dispatch(boardEditingEnded());
    setIsEditing.off();
  };

  const onHowToEditItemSelected = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const howToEdit = Number.parseInt(e.target.value, 10) as HowToEditBoard;
    dispatch(howToEditBoardChanged(howToEdit));
  };

  const onCustomTypeSelected = (nextValue: string) => {
    const customType =
      nextValue === emptyKey
        ? undefined
        : (Number.parseInt(nextValue, 10) as PuyoType);
    dispatch(boardEditCustomTypeChanged(customType));
  };

  return (
    <Popover
      isOpen={isEditing}
      onOpen={setIsEditing.on}
      onClose={setIsEditing.off}
    >
      <Tooltip label="盤面を編集">
        <Box display="inline-block" {...rest}>
          <PopoverTrigger>
            <IconButton
              variant={isBoardEditing ? 'solid' : 'outline'}
              colorScheme={isBoardEditing ? 'teal' : undefined}
              aria-label="盤面を編集"
              icon={<EditIcon />}
            />
          </PopoverTrigger>
        </Box>
      </Tooltip>
      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader>
          <HStack>
            <Text>盤面編集</Text>
          </HStack>
        </PopoverHeader>
        <PopoverBody>
          <HStack>
            <Text fontSize="sm">モード:</Text>
            <Select
              w="13em"
              value={boardEditMode?.howToEdit}
              onChange={onHowToEditItemSelected}
            >
              {possibleHowToEditBoardList.map((howToEdit) => {
                return (
                  <option value={howToEdit} key={howToEdit}>
                    {getHowToEditBoardDescription(howToEdit)}
                  </option>
                );
              })}
            </Select>
          </HStack>

          {boardEditMode?.howToEdit === HowToEditBoard.ToCustomType ? (
            <RadioGroup
              mt={4}
              w={300}
              size="sm"
              value={
                boardEditMode?.customType
                  ? String(boardEditMode.customType)
                  : emptyKey
              }
              onChange={onCustomTypeSelected}
            >
              <SimpleGrid spacing={2} columns={4}>
                {[...puyoTypeMap.entries(), [emptyKey, '空']].map((entry) => {
                  const [type] = entry;
                  return (
                    <Radio key={type} value={String(type)}>
                      {type !== emptyKey ? (
                        <PuyoIcon type={type as PuyoType} />
                      ) : (
                        <Text size="sm">空</Text>
                      )}
                    </Radio>
                  );
                })}
              </SimpleGrid>
            </RadioGroup>
          ) : null}

          <Stack mt="2">
            <HStack ml="auto">
              <Button
                hidden={!isBoardEditing}
                size="sm"
                onClick={onEditEndButtonClicked}
              >
                編集終了
              </Button>
              <Button
                hidden={isBoardEditing}
                size="sm"
                onClick={onEditStartButtonClicked}
              >
                編集開始
              </Button>
            </HStack>
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default BoardEditPopover;
