import { DeleteIcon } from '@chakra-ui/icons';
import {
  Box,
  Grid,
  IconButton,
  type ResponsiveValue,
  Text,
  Tooltip,
  useBreakpointValue
} from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import type { AnimationStep } from '../logics/AnimationStep';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { boardResetButtonClicked } from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import AnimationStepSlider from './settings/AnimationStepSlider';

interface IProps {
  /** 現在なぞり位置 */
  tracingCoords: PuyoCoord[];
  /** コマのリスト */
  animationSteps: AnimationStep[];
  /** コマ位置 */
  activeAnimationStepIndex: number;
  /** 盤面リセットボタンを隠す */
  hideReset: ResponsiveValue<boolean>;
}

/** フィールドコントローラー */
const FieldController: React.FC<IProps> = (props) => {
  const { tracingCoords, animationSteps, activeAnimationStepIndex, hideReset } =
    props;
  const dispatch = useDispatch<AppDispatch>();

  const responsiveHideReset =
    typeof hideReset !== 'boolean'
      ? useBreakpointValue<boolean>(hideReset)
      : hideReset;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const onBoardRestButtonCliecked = () => dispatch(boardResetButtonClicked());

  return (
    <Box minH="40px">
      {animationSteps?.length > 0 ? (
        <Grid gap="1" templateColumns="1fr auto">
          <AnimationStepSlider
            animationSteps={animationSteps}
            index={activeAnimationStepIndex}
          />
          {!responsiveHideReset ? (
            <Tooltip label="盤面リセット">
              <IconButton
                ml="auto"
                variant="outline"
                aria-label="盤面リセット"
                icon={<DeleteIcon />}
                onClick={onBoardRestButtonCliecked}
              />
            </Tooltip>
          ) : null}
        </Grid>
      ) : (
        <Box>
          <Text verticalAlign="middle" lineHeight="20px">
            現在のなぞり:
          </Text>
          <Text verticalAlign="middle" lineHeight="20px">
            {coords || 'なし'}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default FieldController;
