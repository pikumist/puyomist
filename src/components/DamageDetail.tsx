import { Box, HStack, Text } from '@chakra-ui/react';
import type React from 'react';
import type { Chain } from '../logics/Chain';
import type { PuyoAttribute } from '../logics/PuyoAttribute';
import { Simulator } from '../logics/Simulator';
import PuyoIcon from './PuyoIcon';

interface IProps {
  /** ダメージ表示するぷよの属性 */
  attr: PuyoAttribute;

  /** 全連鎖情報 */
  chains: Chain[];

  /** 2行表示にするかどうか */
  isTwoLine: boolean;
}

/** あるぷよ色におけるダメージ詳細 */
const DamageDetail: React.FC<IProps> = (props) => {
  const { chains, attr, isTwoLine } = props;
  const chainsByAttr = chains
    .filter((chain) => {
      const attributeChain = chain.attributes[attr];
      return typeof attributeChain !== 'undefined';
    })
    .map((chain) => {
      return {
        chainNum: chain.chainNum,
        poppedPuyoNum: chain.poppedPuyoNum,
        attributeChain: chain.attributes[attr]
      };
    });

  const totalAttrDamage = Simulator.calcTotalDamageOfTargetAttr(
    chains,
    attr
  ).toFixed(2);

  const totalAttrPoppedNum = chainsByAttr.reduce(
    (m, chain) => m + chain.attributeChain.poppedNum,
    0
  );

  // (連鎖目-分離数-同時消し数) リスト
  const cspList = chainsByAttr.map((chain) => {
    return `${chain.chainNum}-${chain.attributeChain.separatedBlocksNum}-${chain.poppedPuyoNum}`;
  });

  return (
    <Box>
      <HStack spacing="1">
        <PuyoIcon position="relative" top="1px" size={18} attr={attr} />
        <Text>
          <Text as="span">{totalAttrDamage}</Text>{' '}
          <Text as="span" fontSize="xs">
            ({totalAttrPoppedNum}個)
          </Text>
        </Text>
        {!isTwoLine ? (
          <Text fontSize="xs">&nbsp;{cspList.join(', ')}</Text>
        ) : null}
      </HStack>
      {isTwoLine ? (
        <Text ml="4" fontSize="xs">
          &nbsp;{cspList.join(', ')}
        </Text>
      ) : null}
    </Box>
  );
};

export default DamageDetail;
