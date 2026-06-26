import type React from 'react';

import { PuyoIcon } from '@/components/ui/puyo-icon';
import type { Chain } from '@/logics/Chain';
import type { PuyoAttr } from '@/logics/PuyoAttr';
import { Simulator } from '@/logics/Simulator';

interface IProps {
  /** Puyo attribute to show damage for. */
  attr: PuyoAttr;
  /** All chain info. */
  chains: Chain[];
  /** Render the chain breakdown on a second line. */
  isTwoLine: boolean;
}

/** Damage detail for a single puyo colour. */
const DamageDetail: React.FC<IProps> = (props) => {
  const { chains, attr, isTwoLine } = props;
  const chainsByAttr = chains
    .filter((chain) => typeof chain.attributes[attr] !== 'undefined')
    .map((chain) => ({
      chain_num: chain.chain_num,
      simultaneous_num: chain.simultaneous_num,
      attribute_chain: chain.attributes[attr]!
    }));

  const totalAttrDamage = Simulator.calcTotalDamageOfTargetAttr(
    chains,
    attr
  ).toFixed(2);

  const totalAttrPoppedNum = chainsByAttr.reduce(
    (m, chain) => m + chain.attribute_chain.popped_count,
    0
  );

  // (chain - separated blocks - simultaneous) list
  const cspList = chainsByAttr.map(
    (chain) =>
      `${chain.chain_num}-${chain.attribute_chain.separated_blocks_num}-${chain.simultaneous_num}`
  );

  return (
    <div>
      <div className="flex items-center gap-1">
        <PuyoIcon className="relative top-px" size={18} attr={attr} />
        <span className="num">
          <span>{totalAttrDamage}</span>{' '}
          <span className="text-xs">({totalAttrPoppedNum}個)</span>
        </span>
        {!isTwoLine ? (
          <span className="num text-xs">&nbsp;{cspList.join(', ')}</span>
        ) : null}
      </div>
      {isTwoLine ? (
        <div className="num ml-4 text-xs">&nbsp;{cspList.join(', ')}</div>
      ) : null}
    </div>
  );
};

export default DamageDetail;
