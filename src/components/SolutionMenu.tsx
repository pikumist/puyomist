import { CloseIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons';
import { HStack, Icon, IconButton, Tooltip } from '@chakra-ui/react';
import React from 'react';
import { FaPlay } from 'react-icons/fa6';
import { useDispatch } from 'react-redux';
import {
  playSolutionButtonClicked,
  solutionResetButtonClicked,
  solveButtonClicked,
  solveCancelButtonClicked
} from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';

interface IProps {
  solving: boolean;
  hasResult: boolean;
}

/** 探索系のメニュー */
const SolutionMenu: React.FC<IProps> = React.memo((props) => {
  const { solving, hasResult } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onSolutionResetButtonClicked = () =>
    dispatch(solutionResetButtonClicked());

  const onPlaySolutionButtonClicked = () =>
    dispatch(playSolutionButtonClicked());

  const onSolveOrCancelButtonClicked = () => {
    if (solving) {
      dispatch(solveCancelButtonClicked());
    } else {
      dispatch(solveButtonClicked());
    }
  };

  return (
    <HStack spacing="1">
      <Tooltip label={!solving ? '最適解を探索' : '探索をキャンセル'}>
        <IconButton
          variant="outline"
          aria-label={!solving ? '最適解を探索' : '探索をキャンセル'}
          icon={!solving ? <SearchIcon /> : <CloseIcon />}
          onClick={onSolveOrCancelButtonClicked}
        />
      </Tooltip>
      <Tooltip label="探索結果クリア">
        <IconButton
          variant="outline"
          aria-label="探索結果クリア"
          icon={<DeleteIcon />}
          isDisabled={Boolean(!hasResult)}
          onClick={onSolutionResetButtonClicked}
        />
      </Tooltip>
      <Tooltip label="解でなぞり">
        <IconButton
          variant="outline"
          aria-label="解でなぞり"
          icon={<Icon as={FaPlay} />}
          isDisabled={Boolean(!hasResult)}
          onClick={onPlaySolutionButtonClicked}
        />
      </Tooltip>
    </HStack>
  );
});

export default SolutionMenu;
