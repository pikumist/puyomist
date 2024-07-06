import type React from 'react';
import type { Chain } from '../logics/Chain';
import { PuyoAttribute, getPuyoAttributeName } from '../logics/PuyoAttribute';
import styles from './DamageDetail.module.css';

interface IProps {
  /** ダメージ表示するぷよの属性 */
  attr: PuyoAttribute;

  /** 全連鎖情報 */
  chains: Chain[];
}

/** あるぷよ色におけるダメージ詳細 */
const DamageDetail: React.FC<IProps> = (props) => {
  const { chains, attr } = props;
  const attrName = getPuyoAttributeName(attr);

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

  const totalDamageByPrism = chains
    .map((chain) => {
      return chain.attributes[PuyoAttribute.Prism];
    })
    .reduce((m, attributeChain) => {
      return m + (attributeChain?.strength ?? 0);
    }, 0);

  const totalAttrDamage = (
    totalDamageByPrism +
    chainsByAttr.reduce((m, chain) => m + chain.attributeChain.strength, 0)
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
    <div>
      {attrName}: <span>{totalAttrDamage}</span>{' '}
      <span className={styles.poppedNum}>({totalAttrPoppedNum}個)</span>
      <span className={styles.appendix}>{cspList.join(', ')}</span>
    </div>
  );
};

export default DamageDetail;
