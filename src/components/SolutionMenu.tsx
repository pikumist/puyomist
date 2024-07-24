import { CloseIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons';
import { HStack, Icon, IconButton, Tooltip } from '@chakra-ui/react';
import React from 'react';
import { FaPlay, FaRotateRight } from 'react-icons/fa6';
import { useDispatch } from 'react-redux';
import {
  boardResetButtonClicked,
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

  const onBoardRestButtonCliecked = () => dispatch(boardResetButtonClicked());

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
      <Tooltip label="盤面リセット">
        <IconButton
          variant="outline"
          aria-label="盤面リセット"
          icon={<Icon as={FaRotateRight} />}
          onClick={onBoardRestButtonCliecked}
        />
      </Tooltip>
    </HStack>
  );
});

export default SolutionMenu;
