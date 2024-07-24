import { HamburgerIcon } from '@chakra-ui/icons';
import {
  Box,
  type BoxProps,
  CloseButton,
  Drawer,
  DrawerContent,
  Flex,
  type FlexProps,
  HStack,
  IconButton,
  Progress,
  Show,
  Stack,
  Text,
  useColorModeValue,
  useDisclosure
} from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import { dispatchWhenScreenshotReceivedViaWebSocket } from '../hooks/dispatchWhenScreenshotReceivedViaWebSocket';
import { selectActiveChains } from '../hooks/selectActiveChains';
import { customBoardId } from '../logics/boards';
import type { RootState } from '../reducers/store';
import PuyoBoard from './PuyoBoard';
import ScreenshotCanvas from './ScreenshotCanvas';
import SolutionMenu from './SolutionMenu';
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
  const dispatch = useDispatch();
  dispatchWhenScreenshotReceivedViaWebSocket(dispatch);
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const {
    boardId,
    nextSelection,
    boostAreaKeyList,
    isBoardEditing,
    boardEditMode,
    solveResult,
    solving,
    simulationData,
    lastTraceCoords,
    animationSteps,
    activeAnimationStepIndex
  } = state;
  const chains = selectActiveChains(state);
  const hasBoostArea = boostAreaKeyList.length > 0;

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

      <Box
        ml={{ base: 0, md: '290px' }}
        p={{ base: '4', lg: '8', xl: '10' }}
        fontSize={{ base: '1em', xl: '1.15em' }}
      >
        {/* Content */}
        <Stack align={{ base: 'center', md: 'start', lg: 'center' }}>
          <Stack>
            <HStack align="top" spacing={{ base: '4', lg: '6' }}>
              <Box>
                <HStack
                  maxW={{
                    base: '360px',
                    sm: '440px',
                    md: '440px',
                    lg: '440px',
                    xl: '800px'
                  }}
                  mb="1"
                >
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
                <PuyoBoard
                  width={{ base: 360, sm: 440, md: 440, lg: 440, xl: 480 }}
                />
              </Box>
              <Show above="lg">
                <TracingResultView
                  w={{ base: '12em', xl: '14em' }}
                  overflowX="auto"
                  keepSliderArea
                  isDamageTwoLine
                  hasBoostArea={hasBoostArea}
                  tracingCoords={simulationData.traceCoords}
                  lastTraceCoords={lastTraceCoords}
                  chains={chains}
                  animationSteps={animationSteps}
                  activeAnimationStepIndex={activeAnimationStepIndex}
                />
              </Show>
            </HStack>
            <Box>
              <Show below="lg">
                <TracingResultView
                  mb="2"
                  isDamageTwoLine={false}
                  hasBoostArea={hasBoostArea}
                  tracingCoords={simulationData.traceCoords}
                  lastTraceCoords={lastTraceCoords}
                  chains={chains}
                  animationSteps={animationSteps}
                  activeAnimationStepIndex={activeAnimationStepIndex}
                />
              </Show>
              <SolutionMenu
                solving={solving}
                hasResult={Boolean(solveResult)}
              />
              <Progress
                w="172px"
                mt="1"
                size="xs"
                visibility={solving ? 'visible' : 'hidden'}
                isIndeterminate={solving}
              />
              <SolutionResultView result={solveResult} />
            </Box>
          </Stack>
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
      w={{ base: 'full', md: '290px' }}
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
        <ScreenshotCanvas
          mt="4"
          canvasMaxWidth={100}
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
      ml={{ base: 0, md: '290px' }}
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
