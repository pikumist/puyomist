import {
  CloseIcon,
  DeleteIcon,
  HamburgerIcon,
  SearchIcon
} from '@chakra-ui/icons';
import {
  Box,
  type BoxProps,
  CloseButton,
  Drawer,
  DrawerContent,
  Flex,
  type FlexProps,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
  useDisclosure
} from '@chakra-ui/react';
import { FaPlay, FaRotateRight } from 'react-icons/fa6';
import { useDispatch, useSelector } from 'react-redux';
import { customBoardId } from '../logics/boards';
import {
  boardResetButtonClicked,
  playSolutionButtonClicked,
  solutionResetButtonClicked,
  solveButtonClicked,
  solveCancelButtonClicked
} from '../reducers/puyoAppSlice';
import type { AppDispatch, RootState } from '../reducers/store';
import PuyoBoard from './PuyoBoard';
import ScreenshotCanvas from './ScreenshotCanvas';
import SolutionResultView from './SolutionResultView';
import TracingResultView from './TracingResultView';
import AnimationDurationInput from './settings/AnimationDurationInput';
import BoardEditPopover from './settings/BoardEditPopover';
import BoardSelector from './settings/BoardSelector';
import BoostAreaSetting from './settings/BoostAreaSetting';
import ChainLeverageInput from './settings/ChainLeverageInput';
import ExplorationTargetSetting from './settings/ExplorationTargetSetting';
import MaxTraceNumInput from './settings/MaxTraceNumInput';
import MinimumPuyoNumInput from './settings/MinimumPuyoNumInput';
import NextSelector from './settings/NextSelector';
import PoppingLeverageInput from './settings/PoppingLeverageInput';
import SolutionMethodSelector from './settings/SolutionMethodSelector';
import TraceModeSelector from './settings/TraceModeSelector';

/** ぷよクエの最適解探索アプリ */
const PuyoApp: React.FC = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const {
    boardId,
    nextSelection,
    isBoardEditing,
    boardEditMode,
    explorationResult,
    solving,
    simulationData,
    lastTraceCoords,
    chains
  } = state;
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
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      <SidebarContent
        onClose={onClose}
        display={{ base: 'none', md: 'block' }}
      />

      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerContent>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>

      {/* For mobile */}
      <MobileNav display={{ base: 'flex', md: 'none' }} onOpen={onOpen} />

      <Box ml={{ base: 0, md: 80 }} p="4">
        {/* Content */}
        <Stack>
          <HStack maxW="395">
            <BoardSelector boardId={boardId} />
            <NextSelector
              disabled={boardId === customBoardId}
              nextSelection={nextSelection}
            />
            <BoardEditPopover
              isBoardEditing={isBoardEditing}
              boardEditMode={boardEditMode}
              ml={'auto'}
            />
          </HStack>
          <PuyoBoard width={395} />
          <HStack align="top" spacing="4">
            <Box>
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
                    isDisabled={Boolean(!explorationResult)}
                    onClick={onSolutionResetButtonClicked}
                  />
                </Tooltip>
                <Tooltip label="解でなぞり">
                  <IconButton
                    variant="outline"
                    aria-label="解でなぞり"
                    icon={<Icon as={FaPlay} />}
                    isDisabled={Boolean(!explorationResult)}
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
              <SolutionResultView
                solving={solving}
                result={explorationResult}
              />
            </Box>
            <TracingResultView
              tracingCoords={simulationData.traceCoords}
              lastTraceCoords={lastTraceCoords}
              chains={chains}
            />
          </HStack>
        </Stack>
      </Box>
    </Box>
  );
};

export default PuyoApp;

interface SidebarProps extends BoxProps {
  onClose: () => void;
}

const SidebarContent = ({ onClose, ...rest }: SidebarProps) => {
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const {
    boostAreaKeyList,
    simulationData,
    explorationTarget,
    solutionMethod,
    screenshotInfo,
    screenshotErrorMessage
  } = state;
  const {
    traceMode,
    minimumPuyoNumForPopping,
    maxTraceNum,
    poppingLeverage,
    chainLeverage,
    animationDuration
  } = simulationData;

  return (
    <Box
      bg={useColorModeValue('white', 'gray.900')}
      borderRight="1px"
      borderRightColor={useColorModeValue('gray.200', 'gray.700')}
      w={{ base: 'full', md: 80 }}
      pos="fixed"
      overflowY="auto"
      h="full"
      {...rest}
    >
      <Flex h="14" alignItems="center" mx="8" justifyContent="space-between">
        <Text fontSize="2xl" fontFamily="monospace" fontWeight="bold">
          Puyomist
        </Text>
        <CloseButton display={{ base: 'flex', md: 'none' }} onClick={onClose} />
      </Flex>
      <Box mx={4}>
        <TraceModeSelector traceMode={traceMode} />
        <MinimumPuyoNumInput
          traceMode={traceMode}
          num={minimumPuyoNumForPopping}
        />
        <MaxTraceNumInput maxTraceNum={maxTraceNum} />
        <PoppingLeverageInput leverage={poppingLeverage} />
        <ChainLeverageInput leverage={chainLeverage} />
        <BoostAreaSetting boostAreaKeyList={boostAreaKeyList} />
        <AnimationDurationInput duration={animationDuration} />
        <ExplorationTargetSetting target={explorationTarget} />
        <SolutionMethodSelector method={solutionMethod} />
        <hr />
        <ScreenshotCanvas
          maxWidth={100}
          screenshotInfo={screenshotInfo}
          errorMessage={screenshotErrorMessage}
        />
      </Box>
    </Box>
  );
};

interface MobileProps extends FlexProps {
  onOpen: () => void;
}

const MobileNav = ({ onOpen, ...rest }: MobileProps) => {
  return (
    <Flex
      ml={{ base: 0, md: 80 }}
      px={{ base: 4, md: 24 }}
      height="14"
      alignItems="center"
      bg={useColorModeValue('white', 'gray.900')}
      borderBottomWidth="1px"
      borderBottomColor={useColorModeValue('gray.200', 'gray.700')}
      justifyContent="flex-start"
      {...rest}
    >
      <IconButton
        variant="outline"
        onClick={onOpen}
        aria-label="open menu"
        icon={<HamburgerIcon />}
      />

      <Text fontSize="2xl" ml="8" fontFamily="monospace" fontWeight="bold">
        Puyomist
      </Text>
    </Flex>
  );
};
